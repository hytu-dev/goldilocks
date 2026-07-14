import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { hyphenate } from "../../src/hyphenate";

const ROOT = resolve(import.meta.dirname, "../..");
const OUTPUT = resolve(ROOT, "fixtures/mismatches.hyp");
const lines = readFileSync(resolve(ROOT, "fixtures/golden.hyp"), "utf-8").trimEnd().split("\n");

const mismatches: Mismatch[] = [];
for (const line of lines) {
  const [word, expected = ""] = line.split("\t");
  const actual = hyphenate(word).join(",");
  if (actual !== expected) mismatches.push({ word, expected, actual });
}

if (existsSync(OUTPUT)) unlinkSync(OUTPUT);
if (mismatches.length === 0) process.exit(0);

const report = mismatches.map((m) => `${m.word}\t${m.expected}\t${m.actual}`).join("\n");
writeFileSync(OUTPUT, report + "\n");
process.exit(1);

// helpers -----------------------------------------------------------------------------------------
interface Mismatch {
  word: string;
  expected: string;
  actual: string;
}
