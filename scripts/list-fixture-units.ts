import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LabReportExtractor, NumberParser } from "@lablens/ocr";

const dir = fileURLToPath(
  new URL("../packages/lablens-ocr/test/fixtures", import.meta.url)
);

async function main(): Promise<void> {
  const ex = new LabReportExtractor(new NumberParser());
  const units = new Map<string, number>();
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json")).sort()) {
    const fx = JSON.parse(await readFile(`${dir}/${f}`, "utf8"));
    const res = {
      text: fx.text,
      confidence: fx.confidence,
      cells: fx.lines.map((l: any[]) =>
        l.map((c: any) => ({
          text: c.text,
          confidence: c.confidence,
          box: c.box
        }))
      )
    };
    for (const v of ex.extract(res)) {
      if (v.rawUnit) {
        units.set(v.rawUnit, (units.get(v.rawUnit) ?? 0) + 1);
      }
    }
  }
  for (const [u, c] of [...units.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(String(c).padStart(3), JSON.stringify(u));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
