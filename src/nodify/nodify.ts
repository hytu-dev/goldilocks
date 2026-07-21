import { hyphenate } from "../hyphenate";
import type { TeXNode } from "./types";

const SEGMENT = /\p{L}+|\u002D|[^\p{L}\u002D]+/gu;
const LETTERS = /^\p{L}+$/u;

export function nodify(text: string): TeXNode[] {
  const chunks = text.trim().split(/\s+/);
  const nodes: TeXNode[] = [];

  for (let i = 0; i < chunks.length; ++i) {
    if (i > 0) nodes.push({ type: "glue", text: "\u00A0" });
    nodifySegments(chunks[i], nodes);
  }

  return nodes;
}

// helpers -----------------------------------------------------------------------------------------

function nodifySegments(chunk: string, nodes: TeXNode[]): void {
  const segments = mergeTrailingHyphen(chunk.match(SEGMENT) ?? []);
  for (let i = 0; i < segments.length; ++i) {
    const segment = segments[i];
    if (!LETTERS.test(segment)) {
      nodes.push({ type: "box", text: segment });
      if (segment === "\u002D" && i < segments.length - 1)
        nodes.push({ type: "penalty", text: "", flag: false });
      continue;
    }
    if (segments[i - 1] === "\u002D" || segments[i + 1] === "\u002D") {
      nodes.push({ type: "box", text: segment });
    } else {
      const syllables = splitBySyllable(segment, hyphenate(segment));
      for (let j = 0; j < syllables.length; j++) {
        if (j > 0) nodes.push({ type: "penalty", text: "", flag: true });
        nodes.push({ type: "box", text: syllables[j] });
      }
    }
  }
}

function mergeTrailingHyphen(raw: string[]): string[] {
  if (raw.length >= 2 && raw[raw.length - 1] === "\u002D" && !LETTERS.test(raw[raw.length - 2]))
    raw[raw.length - 2] += raw.pop();
  return raw;
}

function splitBySyllable(word: string, points: number[]): string[] {
  const starts = [0, ...points];
  const ends = [...points, word.length];
  return starts.map((start, i) => word.slice(start, ends[i]));
}
