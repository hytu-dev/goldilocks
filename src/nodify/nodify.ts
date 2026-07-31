// Mirrors hnj_hyphenation() + find_next_wordstart() in texlang.c, assuming engine defaults:
// \automatichyphenmode=0, \compoundhyphenmode=1, \uchyph=1.

import { disc, glue, HYPH, type Item, item, type TeXNode } from "../defs.ts";
import { hyphenate } from "../hyphenate/index.ts";

// \p{L} approximates hjcode > 0, which falls back to lccode by default.
// The literal hyphen must stay in sync with HYPH.
const RUN = /(?<glue>\s+)|(?<hyph>-+)|(?<word>\p{L}+)|(?<other>[^\s\p{L}-]+)/gu;
const LETTER = /\p{L}/u;
// ready:  start_ok; only words entering the matcher here are hyphenated
// inside: mid-compound, so letters extend a word rather than beginning one
// dead:   an explicit hyphen was seen; nothing starts until glue clears it
type State = "ready" | "inside" | "dead";
type Token = { kind: Kind; text: string };
type Kind = "glue" | "hyph" | "word" | "other";

export function nodify(text: string, discMode: boolean): TeXNode[] {
  const tokens = tokenize(text);
  const nodes: TeXNode[] = [];
  let state = "ready" as State; // ts7022

  for (const [i, { kind, text: run }] of tokens.entries()) {
    const next = tokens[i + 1]?.kind ?? "glue"; // input is trimmed, so end of text is a boundary
    switch (kind) {
      case "glue":
        nodes.push(glue());
        state = "ready";
        break;

      case "word": {
        const points = discMode && state === "ready" && next !== "hyph" ? hyphenate(run) : [];
        const discs = points.map((p) => disc(p, HYPH, "", ""));
        nodes.push(item(run, discs));
        state = state === "dead" ? "dead" : "inside";
        break;
      }

      case "hyph": {
        // A disc needs a following character to attach to, and within a run of hyphens only the
        // last one can carry it.
        const carry = next !== "glue" && (run.length === 1 || state === "inside");
        if (carry) {
          if (run.length > 1) nodes.push(item(run.slice(0, -1)));
          nodes.push(item(HYPH, [disc(1)]));
        } else {
          nodes.push(item(run));
        }
        state = carry && run.length === 1 && state === "inside" ? "inside" : "dead";
        break;
      }

      case "other":
        nodes.push(item(run));
        // Non-letters (lc_code=0) are transparent, not word-terminating.
        // Only non-char nodes clear start_ok for \wordboundary.
        state = state === "dead" ? "dead" : "ready";
        break;
    }
  }

  return coalesce(nodes);
}

function tokenize(text: string): Token[] {
  return Array.from(text.trim().matchAll(RUN), (m) => {
    if (m.groups?.glue) return { kind: "glue", text: m[0] };
    if (m.groups?.hyph) return { kind: "hyph", text: m[0] };
    if (m.groups?.word) return { kind: "word", text: m[0] };
    return { kind: "other", text: m[0] };
  });
}

// Items are split at letter/non-letter boundaries only because the disc rules need that granularity
// Rejoin the non-letter runs the split left behind
function coalesce(nodes: TeXNode[]): TeXNode[] {
  const result: TeXNode[] = [];
  let open: Item | null = null; // holding the merge target avoids re-testing text that already grew
  for (const curr of nodes) {
    if (!mergeable(curr)) {
      result.push(curr);
      open = null;
    } else if (open) {
      open.text += curr.text;
    } else {
      open = curr;
      result.push(curr);
    }
  }
  return result;
}

function mergeable(node: TeXNode): node is Item {
  return node.type === "item" && !node.discs && !LETTER.test(node.text);
}
