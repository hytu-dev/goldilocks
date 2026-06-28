import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src/hyphenation");
const rawPatterns = readLines(resolve(SRC, "patterns/patterns.txt"));
const rawExceptions = readLines(resolve(SRC, "patterns/exceptions.txt"));

const trie = buildTrie(rawPatterns);
const exceptions = buildExceptions(rawExceptions);

const trieJSON = JSON.stringify(trie);
const exceptionsJSON = JSON.stringify(exceptions);

const output = `// Auto-generated from hyph-en-us patterns — do not edit
import type { TrieNode } from "./types";

export const trie: TrieNode = ${trieJSON};
export const exceptions: Record<string, number[]> = ${exceptionsJSON};\n`;

writeFileSync(resolve(SRC, "trie-en-us.ts"), output);
console.log(`Done → src/hyphenation/trie-en-us.ts`);
console.log(`Patterns: ${rawPatterns.length}`);
console.log(`Exceptions: ${Object.keys(exceptions).length}`);

// helpers ----------------------------------------------------------------------------------------

interface TrieNode {
  [key: string]: TrieNode | number[] | undefined;
  _?: number[];
}

function readLines(path: string): string[] {
  return readFileSync(path, "utf8").split("\n").filter(Boolean);
}

// Parse TeX hyphenation pattern (".hy1p" → letters ".hyp", values [0,0,0,1,0])
function parsePattern(raw: string): { letters: string; values: number[] } {
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

function buildTrie(lines: string[]): TrieNode {
  const trie: TrieNode = {};
  for (const raw of lines) {
    const { letters, values } = parsePattern(raw);
    let node = trie;
    for (const c of letters) node = (node[c] ??= {}) as TrieNode;
    node._ = values;
  }
  return trie;
}

function buildExceptions(lines: string[]): Record<string, number[]> {
  const exceptions: Record<string, number[]> = {};
  for (const raw of lines) {
    const word = raw.replaceAll("-", "");
    const breaks = [...raw.matchAll(/-/g)].map((m, i) => m.index! - i);
    exceptions[word] = breaks;
  }
  return exceptions;
}
