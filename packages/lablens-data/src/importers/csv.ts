import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export async function* iterateCsvRows(
  path: string
): AsyncGenerator<string[]> {
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for await (const line of rl) {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else {
        field += ch;
      }
    }

    if (inQuotes) {
      field += "\n";
    } else {
      row.push(field);
      field = "";
      yield row;
      row = [];
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    yield row;
  }
}
