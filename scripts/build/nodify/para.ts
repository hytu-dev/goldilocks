import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import { load } from "cheerio";

const name = process.argv[2];
if (!name) process.exit(1);

const DATA = resolve(import.meta.dirname, "../../../data");
const html = readFileSync(resolve(DATA, `${name}.html`), "utf-8");
const parse = load(html);
const paras = parse("p").map((_, p) => parse(p).text().replace(/\s+/g, " ").trim());

const output = paras.get().filter(Boolean).join("\n");
writeFileSync(resolve(DATA, name), output + "\n");
await rm(resolve(DATA, `${name}.html`));
