import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";

const __dirname = import.meta.dirname;
const ROOT = resolve(__dirname, "../..");
const words = readFileSync(resolve(ROOT, "data/words"), "utf-8").trimEnd().split("\n");
const lines = readFileSync(resolve(__dirname, "./golden.log"), "utf-8").trimEnd().split("\n");

let index = 0;
const results: { word: string; positions: number[] }[] = [];
const prefix = "[] \\tenrm ";

for (const line of lines) {
  if (!line.startsWith(prefix)) continue;
  const hyphenated = line.slice(prefix.length);
  results.push({ word: words[index++], positions: toPositions(hyphenated) });
}

if (index !== words.length) {
  console.error(`ERROR: only matched ${index} / ${words.length} words.`);
  process.exit(1);
}

const output = results.map((r) => `${r.word}\t${r.positions.join(",")}`).join("\n");
writeFileSync(resolve(ROOT, "fixtures/golden.hyp"), output + "\n");
await rm(resolve(__dirname, "./golden.log"));

// helpers -----------------------------------------------------------------------------------------

function toPositions(hyphenated: string): number[] {
  const segments = hyphenated.split("-");
  segments.pop();
  let acc = 0;
  return segments.map((s) => (acc += s.length));
}
