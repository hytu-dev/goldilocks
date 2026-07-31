import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TeXNode } from "../../src/defs.ts";
import { nodify } from "../../src/nodify/index.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const OUTPUT = resolve(ROOT, "fixtures/mismatches.nod");
const lines = readFileSync(resolve(ROOT, "fixtures/golden.nod"), "utf-8").trimEnd().split("\n");

const mismatches: Mismatch[] = [];

for (const line of lines) {
  const tab = line.indexOf("\t");
  const paragraph = line.slice(0, tab);
  const expected = line.slice(tab + 1);
  const actual = serialize(nodify(paragraph, true));
  if (actual !== expected) mismatches.push({ paragraph, expected, actual });
}

if (existsSync(OUTPUT)) unlinkSync(OUTPUT);
if (mismatches.length === 0) process.exit(0);

const report = mismatches.map((m) => `${m.paragraph}\t${m.expected}\t${m.actual}`).join("\n");
writeFileSync(OUTPUT, `${report}\n`);
process.exit(1);

// helpers -----------------------------------------------------------------------------------------

function serialize(nodes: TeXNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "glue") return "G";
      let s = `I:${n.text}`;
      if (n.discs && n.discs.length > 0) {
        s += `[${n.discs.map((d) => `${d.offset},${d.pre},${d.post},${d.replace}`).join(";")}]`;
      }
      return s;
    })
    .join("|");
}

interface Mismatch {
  paragraph: string;
  expected: string;
  actual: string;
}
