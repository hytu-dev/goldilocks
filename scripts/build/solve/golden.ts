import { readFileSync, writeFileSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { resolve } from "node:path";

const __dirname = import.meta.dirname;
const ROOT = resolve(__dirname, "../../..");
const paragraphs = readFileSync(resolve(ROOT, "data/paras"), "utf-8").trimEnd().split("\n");
const entries = readFileSync(resolve(__dirname, "./golden"), "utf-8").trimEnd().split("\n");

if (entries.length !== paragraphs.length) {
  console.error(`ERROR: ${entries.length} @@SOL entries but ${paragraphs.length} paragraphs.`);
  process.exit(1);
}

const output = paragraphs.map((p, i) => `${p}\t${entries[i]}`).join("\n");
writeFileSync(resolve(ROOT, "fixtures/golden.sol"), `${output}\n`);
await rename(resolve(__dirname, "./metrics"), resolve(ROOT, "fixtures/metrics.sol"));
await rm(resolve(__dirname, "./golden"));
