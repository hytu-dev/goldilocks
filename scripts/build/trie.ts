import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const rawPats = readFileSync(resolve(ROOT, "data/en-us.pat"), "utf-8").trimEnd().split("\n");
const rawHyps = readFileSync(resolve(ROOT, "data/en-us.hyp"), "utf-8").trimEnd().split("\n");

const trieJSON = JSON.stringify(buildTrie(rawPats));
const hypsJSON = JSON.stringify(buildHyps(rawHyps));

const output = `// Auto-generated from hyph-en-us patterns — do not edit
import type { TrieNode } from "./types";

export const trie: TrieNode = ${trieJSON};
export const exceptions: Record<string, number[]> = ${hypsJSON};\n`;

writeFileSync(resolve(resolve(ROOT, "src/hyphenation"), "trie-en-us.ts"), output);

// helpers ----------------------------------------------------------------------------------------

interface TrieNode {
  [key: string]: TrieNode | number[] | undefined;
  _?: number[];
}

function buildTrie(lines: string[]): TrieNode {
  const trie: TrieNode = {};
  for (const raw of lines) {
    const { letters, values } = parsePats(raw);
    let node = trie;
    for (const c of letters) node = (node[c] ??= {}) as TrieNode;
    node._ = values;
  }
  return trie;
}

// Parse TeX hyphenation pattern (".hy1p" → letters ".hyp", values [0,0,0,1,0])
function parsePats(raw: string): { letters: string; values: number[] } {
  const letters: string[] = [];
  const values: number[] = [0];
  for (const c of raw) {
    if (c >= "0" && c <= "9") {
      values[values.length - 1] = +c;
      continue;
    }
    letters.push(c);
    values.push(0);
  }
  return { letters: letters.join(""), values };
}

function buildHyps(lines: string[]): Record<string, number[]> {
  const exceptions: Record<string, number[]> = {};
  for (const raw of lines) {
    const word = raw.replaceAll("-", "");
    const breaks = [...raw.matchAll(/-/g)].map((m, i) => m.index! - i);
    exceptions[word] = breaks;
  }
  return exceptions;
}
