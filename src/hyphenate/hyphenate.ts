// Liang-Knuth hyphenation: patterns encode multi-level priorities where odd = break,
// even = inhibit, and higher levels override lower ones.

import { exceptions, trie } from "./trie-en-us";
import type { TrieNode } from "./types";

const LEFT_MIN = 2;
const RIGHT_MIN = 3;

export function hyphenate(word: string): number[] {
  const lower = word.toLowerCase();
  if (Object.hasOwn(exceptions, lower)) return exceptions[lower];

  const padded = `.${lower}.`;
  const levels = computeLevels(padded);

  return collectBreakPoints(levels, lower.length);
}

// helpers -----------------------------------------------------------------------------------------

function computeLevels(padded: string): number[] {
  const paddedLen = padded.length;
  const levels = new Array<number>(paddedLen + 1).fill(0);
  for (let i = 0; i < paddedLen; ++i) {
    let node: TrieNode | undefined = trie;
    for (let j = i; j < paddedLen; ++j) {
      node = node[padded[j]] as TrieNode | undefined;
      if (!node) break;
      if (node._) applyValues(levels, node._, i);
    }
  }
  const wordLen = paddedLen - 2;
  return levels.slice(1, wordLen + 1);
}

function applyValues(levels: number[], values: number[], offset: number): void {
  for (let k = 0; k < values.length; ++k)
    if (values[k] > levels[offset + k]) levels[offset + k] = values[k];
}

function collectBreakPoints(levels: number[], wordLen: number): number[] {
  const points: number[] = [];
  for (let i = 1; i < wordLen; ++i) {
    if (i < LEFT_MIN || i > wordLen - RIGHT_MIN) continue;
    if (!(levels[i] & 1)) continue;
    points.push(i);
  }
  return points;
}
