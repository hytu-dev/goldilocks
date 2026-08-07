// Light-DOM annotation. The paragraph text is written back with exactly the break opportunities the
// solver chose: a real space where a glue break was taken, NBSP everywhere else, a soft hyphen at a
// chosen disc, and a word joiner sealing every character the browser would otherwise break at on its
// own. The browser is then left with one legal break per line and reproduces the layout by itself,
// which keeps the text a single run for selection, search and justification.

import { type Item, NBSP, type TeXNode } from "../defs.ts";
import type { Break } from "../solve/index.ts";

const SPACE = "\u0020";
const SHY = "\u00AD"; // soft hyphen: a break opportunity that prints a hyphen when it is taken
const WJ = "\u2060"; // word joiner: zero width, forbids a break on either side of itself

// Characters UAX #14 lets a line break after but nodify does not model as a disc. Sealing them keeps
// the browser's legal breaks equal to the solver's; the solver already proved the run fits unbroken.
const BREAKY = /[-\u2010-\u2015\u002F\u2044]/gu;

/** The annotated text of a solved paragraph, ready to be dropped back into the element. */
export function render(nodes: readonly TeXNode[], breaks: readonly Break[]): string {
  const chosen = new Map<number, number[]>();
  for (const { node, disc } of breaks) {
    const taken = chosen.get(node) ?? [];
    if (disc !== undefined) taken.push(disc); // a glue break leaves the list empty, and unread
    chosen.set(node, taken);
  }

  let text = "";
  for (const [i, node] of nodes.entries())
    text +=
      node.type === "glue" ? (chosen.has(i) ? SPACE : NBSP) : paint(node, chosen.get(i) ?? []);
  return text;
}

// helpers -----------------------------------------------------------------------------------------

/** One item's text with the chosen discs opened and every other break opportunity sealed shut. */
function paint(item: Item, taken: readonly number[]): string {
  let text = "";
  let cursor = 0;
  for (const i of taken) {
    const d = item.discs?.[i];
    if (!d) continue;
    // An empty pre marks an explicit hyphen, whose own character already offers the break, so
    // opening the chunk is enough. A non-empty pre needs SHY to carry the printed hyphen.
    text += open(item.text.slice(cursor, d.offset)) + (d.pre ? SHY : "") + d.post;
    cursor = d.offset + d.replace.length;
  }
  return text + seal(item.text.slice(cursor));
}

function seal(text: string): string {
  return text.replace(BREAKY, (c) => c + WJ);
}

/** Sealed, except at the very end, where a break is about to be taken. */
function open(text: string): string {
  const sealed = seal(text);
  return sealed.endsWith(WJ) ? sealed.slice(0, -WJ.length) : sealed;
}
