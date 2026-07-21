import { readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const __dirname = import.meta.dirname;
const ROOT = resolve(__dirname, "../../..");
const paragraphs = readFileSync(resolve(ROOT, "data/paras"), "utf-8").trimEnd().split("\n");
const entries = readFileSync(resolve(__dirname, "./golden"), "utf-8").trimEnd().split("\n");

if (entries.length !== paragraphs.length) {
  console.error(`ERROR: ${entries.length} @@NOD entries but ${paragraphs.length} paragraphs.`);
  process.exit(1);
}

const output = paragraphs.map((p, i) => `${p}\t${entries[i]}`).join("\n");
writeFileSync(resolve(ROOT, "fixtures/golden.nod"), `${output}\n`);
await rm(resolve(__dirname, "./golden"));
