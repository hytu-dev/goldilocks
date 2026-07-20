import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { nodify } from "../../src/nodify/nodify";
import type { TeXNode } from "../../src/nodify/types";

const ROOT = resolve(import.meta.dirname, "../..");
const OUTPUT = resolve(ROOT, "fixtures/mismatches.nod");
const lines = readFileSync(resolve(ROOT, "fixtures/golden.nod"), "utf-8").trimEnd().split("\n");

const mismatches: Mismatch[] = [];

for (const line of lines) {
  const tab = line.indexOf("\t");
  const paragraph = line.slice(0, tab);
  const expected = line.slice(tab + 1);
  const actual = serialize(nodify(paragraph));
  if (actual !== expected) mismatches.push({ paragraph, expected, actual });
}

if (existsSync(OUTPUT)) unlinkSync(OUTPUT);
if (mismatches.length === 0) process.exit(0);

const report = mismatches.map((m) => `${m.paragraph}\t${m.expected}\t${m.actual}`).join("\n");
writeFileSync(OUTPUT, report + "\n");
process.exit(1);

// helpers -----------------------------------------------------------------------------------------

function serialize(nodes: TeXNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "box":
          return `B:${n.text}`;
        case "glue":
          return "G";
        case "penalty":
          return `P:${n.flag ? "t" : "f"}`;
      }
    })
    .join("|");
}

interface Mismatch {
  paragraph: string;
  expected: string;
  actual: string;
}
