import { GoldiBreak } from "../main.ts";
import { EPSILON, fuse, type Item, type ReadonlyMarks, type ReadonlyNodes } from "../nodes/defs.ts";
import * as Space from "../space/init.ts";

// a run whose width in place differs from its measure by more than this has been shaped across a
// space: the measures come from snippets shaped on their own
const LIMIT = 2 / 60;

type Fail = {
  element: number;
  run: number;
  text: string;
  place: number;
  stash: number;
  diff: number;
};

// compares the width of every run of text between two spaces, as laid out, with the sum of the
// stashed widths of its snippets (one per line it spans); logs and returns the runs that differ
export function scan(element?: GoldiBreak): Fail[] {
  const elements = element ? [element] : [...document.querySelectorAll<GoldiBreak>("goldi-break")];
  const fails: Fail[] = [];
  let count = 0;

  for (const [e, el] of elements.entries()) {
    if (!el.nodes || !el.marks) {
      console.warn(`scan: element ${e} is not typeset`);
      continue;
    }
    const stashed = expect(el.nodes, el.marks);
    const placed = runs(el);
    if (stashed.length !== placed.length) {
      console.warn(`scan: element ${e} has ${placed.length} runs for ${stashed.length} items`);
      continue;
    }
    for (const [r, range] of placed.entries()) {
      const place = [...range.getClientRects()].reduce((sum, rect) => sum + rect.width, 0);
      const diff = place - stashed[r];
      if (Math.abs(diff) > LIMIT) {
        fails.push({ element: e, run: r, text: range.toString(), place, stash: stashed[r], diff });
      }
    }
    count += placed.length;
  }

  if (fails.length) console.table(fails);
  console.log(`scan: ${count} runs, ${fails.length} failed`);
  return fails;
}

// helpers -----------------------------------------------------------------------------------------

// the stashed width of each item, as the sum of the snippets it is broken into
function expect(nodes: ReadonlyNodes, marks: ReadonlyMarks): number[] {
  const widths: number[] = [];
  for (const [nidx, node] of nodes.entries()) {
    if (node.type !== "item") continue;
    const didxs = marks.filter((m) => m.nidx === nidx && m.didx !== undefined).map((m) => m.didx);
    const bounds = [-1, ...(didxs as number[]), node.discs.length];
    let width = 0;
    for (let i = 1; i < bounds.length; ++i) width += snippet(node, bounds[i - 1], bounds[i]);
    widths.push(width);
  }
  return widths;
}

function snippet(item: Item, i: number, j: number): number {
  return (GoldiBreak.stash.get(fuse(item, i, j)) ?? Number.NaN) - EPSILON;
}

// a range over each run of text between two spaces
function runs(element: Element): Range[] {
  const ranges: Range[] = [];
  let range: Range | null = null;
  for (const child of element.childNodes) {
    if (child.nodeName === Space.TAG.toUpperCase()) {
      range = null;
      continue;
    }
    if (!range) {
      range = document.createRange();
      range.setStartBefore(child);
      ranges.push(range);
    }
    range.setEndAfter(child);
  }
  return ranges;
}
