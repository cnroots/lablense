import type { OcrCell } from "../extraction/ocr-result";

export interface TableDetection {
  columns: number[];
  rows: string[][];
}

function nearestColumn(x: number, columns: number[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < columns.length; i++) {
    const d = Math.abs(x - columns[i]!);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

interface Cluster {
  min: number;
  max: number;
  sum: number;
  count: number;
  lines: Set<number>;
  items: CellRef[];
}

interface CellRef {
  x: number;
  line: number;
}

export function reconstructTable(
  cells: OcrCell[][],
  imageWidth: number
): TableDetection {
  const tolerance = Math.max(20, 0.04 * imageWidth);

  const refs: CellRef[] = [];
  for (let li = 0; li < cells.length; li++) {
    for (const cell of cells[li] ?? []) {
      refs.push({ x: cell.box.x, line: li });
    }
  }
  if (refs.length === 0) return { columns: [], rows: [] };

  const clusters = chainClusters(refs, tolerance).flatMap((c) =>
    refineCluster(c, tolerance)
  );
  const candidates = clusters
    .filter((c) => c.lines.size >= 2)
    .sort((a, b) => a.min - b.min);
  if (candidates.length === 0) return { columns: [], rows: [] };
  const columns = candidates.map((c) => Math.round(c.sum / c.count));

  const kept = candidates.filter((c) => {
    const idx = nearestColumn(Math.round(c.sum / c.count), columns);
    let shared = 0;
    for (const li of c.lines) {
      const line = cells[li] ?? [];
      if (line.some((cell) => nearestColumn(cell.box.x, columns) !== idx)) {
        shared++;
      }
    }
    return shared >= 2;
  });
  if (kept.length === 0) return { columns: [], rows: [] };
  const finalColumns = kept.map((c) => Math.round(c.sum / c.count));

  const cellsPerCol = columns.map(() => 0);
  for (const cell of refs) cellsPerCol[nearestColumn(cell.x, columns)]!++;
  const isSectionCol =
    columns.length >= 3 && (cellsPerCol[0] ?? 0) < (cellsPerCol[1] ?? 0) * 0.6;

  const boundaries: number[] = [];
  for (let i = 0; i < finalColumns.length - 1; i++) {
    boundaries.push((finalColumns[i]! + finalColumns[i + 1]!) / 2);
  }

  const refinedLines = cells.map((line) =>
    line.flatMap((cell) =>
      refineCell(cell, line, finalColumns, boundaries, isSectionCol)
    )
  );

  const rows = refinedLines.map((line) => {
    const row = new Array<string>(finalColumns.length).fill("");
    for (const cell of line) {
      const idx = nearestColumn(cell.box.x, finalColumns);
      if (Math.abs(cell.box.x - finalColumns[idx]!) > tolerance) continue;
      const text = cell.text.trim();
      row[idx] = row[idx] ? `${row[idx]} ${text}` : text;
    }
    return row;
  });

  return { columns: finalColumns, rows };
}

const TOKEN_NUMERIC = /^[<>≤≥]?\d[\d.,%\s-]*$/;
const TOKEN_OPERATOR = /^[<>≤≥]+$/;
const TOKEN_UNIT = /[/%²³]|^[GLgl]$/;
const TOKEN_DATE = /^\d{1,2}[.,]\d{1,2}[.,]\d{2,4}$/;

type TokenKind = "numeric" | "unit" | "name";

function tokenType(token: string): TokenKind {
  if (TOKEN_DATE.test(token)) return "name";
  if (TOKEN_OPERATOR.test(token) || TOKEN_NUMERIC.test(token)) return "numeric";
  if (TOKEN_UNIT.test(token)) return "unit";
  return "name";
}

function refineCell(
  cell: OcrCell,
  line: OcrCell[],
  columns: number[],
  boundaries: number[],
  isSectionCol: boolean
): OcrCell[] {
  const owning = nearestColumn(cell.box.x, columns);
  const crossed = boundaries.filter(
    (b) => cell.box.x < b && b < cell.box.x + cell.box.width
  );
  if (crossed.length === 0 || line.length < 2 || owning + 1 >= columns.length) {
    return [cell];
  }
  const tokens = cell.text.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return [cell];
  const types = tokens.map(tokenType);

  const splits: number[] = [];
  let ui = types.length;
  while (ui > 0 && types[ui - 1] === "unit") ui--;
  if (ui < types.length && ui > 0 && types[ui - 1] === "numeric") {
    splits.push(ui);
  }
  const end = ui < types.length ? ui : types.length;
  let ni = end;
  while (ni > 0 && types[ni - 1] === "numeric") ni--;
  if (ni < end && ni > 0) splits.push(ni);
  if (isSectionCol && owning === 0) splits.push(1);

  const cut = [...new Set(splits)].sort((a, b) => a - b).slice(0, crossed.length);
  if (cut.length === 0) return [cell];

  const out: OcrCell[] = [];
  let start = 0;
  for (let i = 0; i < cut.length; i++) {
    const text = tokens.slice(start, cut[i]).join(" ");
    if (text) out.push(virtualCell(text, cell.box, columns[owning + i]!));
    start = cut[i]!;
  }
  const rest = tokens.slice(start).join(" ");
  if (rest) out.push(virtualCell(rest, cell.box, columns[owning + cut.length]!));
  return out.length >= 2 ? out : [cell];
}

function virtualCell(text: string, box: OcrCell["box"], x: number): OcrCell {
  return { text, box: { x, y: box.y, width: box.width, height: box.height }, confidence: 1 };
}

function chainClusters(cells: CellRef[], tolerance: number): Cluster[] {
  const sorted = [...cells].sort((a, b) => a.x - b.x);
  const clusters: Cluster[] = [];
  for (const cell of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && cell.x - last.max <= tolerance) {
      last.max = cell.x;
      last.sum += cell.x;
      last.count += 1;
      last.lines.add(cell.line);
      last.items.push(cell);
    } else {
      clusters.push({
        min: cell.x,
        max: cell.x,
        sum: cell.x,
        count: 1,
        lines: new Set([cell.line]),
        items: [cell]
      });
    }
  }
  return clusters;
}

function refineCluster(cluster: Cluster, tolerance: number): Cluster[] {
  if (cluster.items.length <= 1 || cluster.max - cluster.min <= tolerance * 0.9) {
    return [cluster];
  }
  const xs = [...new Set(cluster.items.map((c) => c.x))].sort((a, b) => a - b);
  let bestIdx = -1;
  let bestGap = 0;
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i]! - xs[i - 1]!;
    if (gap > bestGap) {
      bestGap = gap;
      bestIdx = i;
    }
  }
  const boundary = (xs[bestIdx - 1]! + xs[bestIdx]!) / 2;
  const left: CellRef[] = [];
  const right: CellRef[] = [];
  for (const item of cluster.items) {
    (item.x <= boundary ? left : right).push(item);
  }
  const parts: Cluster[] = [];
  for (const items of [left, right]) {
    if (items.length === 0) continue;
    const sub: Cluster = {
      min: Math.min(...items.map((c) => c.x)),
      max: Math.max(...items.map((c) => c.x)),
      sum: items.reduce((a, c) => a + c.x, 0),
      count: items.length,
      lines: new Set(items.map((c) => c.line)),
      items
    };
    if (sub.lines.size >= 2) parts.push(...refineCluster(sub, tolerance));
  }
  if (parts.length > 0) return parts;
  return [];
}
