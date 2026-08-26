import * as Knuth from "../knuth/defs.ts";
import type { Item, Mark, ReadonlyMarks, ReadonlyNodes, ReadonlyStash } from "./defs.ts";
import { fuse } from "./defs.ts";

type Spec = { lineWidth: number; emergency: number };
type Rung = Spec & { tolerance: number; hyphenate: boolean };
type Para = { stash: ReadonlyStash; nodes: ReadonlyNodes; w: number[]; s: number[] };
type Live = { mark: Mark; prev: Live | null; fitness: number; demerit: number };

export function wrap(stash: ReadonlyStash, nodes: ReadonlyNodes, spec: Spec): ReadonlyMarks | null {
  const { lineWidth, emergency } = spec;
  const rungs: Rung[] = [
    { lineWidth, emergency: 0, tolerance: Knuth.pretolerance, hyphenate: false },
    { lineWidth, emergency: 0, tolerance: Knuth.tolerance, hyphenate: true },
    { lineWidth, emergency, tolerance: Knuth.tolerance, hyphenate: true },
  ];

  const para = summate(stash, nodes);

  for (const rung of rungs) {
    let lives: Live[] = [genesis()];

    for (const b of breaks(nodes, rung.hyphenate)) {
      const lefts: Live[] = [];
      // three fitness classes; without shrink, no line is ever tight
      const elite: (Live | null)[] = [null, null, null];

      for (const l of lives) {
        const width = natural(para, l.mark, b);
        if (width > rung.lineWidth) continue;
        lefts.push(l);
        const found = demerit(para, l, b, rung, width);
        if (!found) continue;
        const prior = elite[found.fitness];
        // tex breaks ties in favour of the later candidate (tex.web 855), hence <= rather than <
        if (!prior || found.demerit <= prior.demerit) elite[found.fitness] = found;
      }

      const picks = elite.filter((n) => n !== null);
      if (b.nidx === nodes.length) {
        if (picks.length) return retrace(minimum(picks));
        break;
      }
      lives = [...lefts, ...picks];
      if (lives.length === 0) break; // nothing left that can reach the end
    }
  }

  return null;
}

// helpers -----------------------------------------------------------------------------------------

function summate(stash: ReadonlyStash, nodes: ReadonlyNodes): Para {
  const w = [0];
  const s = [0];
  for (const [nidx, node] of nodes.entries()) {
    const width = stash.get(node.text)!;
    w.push(w[nidx] + width);
    s.push(s[nidx] + (node.type === "glue" ? node.ratio * width : 0));
  }
  return { stash: stash, nodes, w, s };
}

// the origin sits before node 0, so that w[mark.nidx + 1] is w[0] with no special case
function genesis(): Live {
  return { mark: { nidx: -1 }, prev: null, fitness: Knuth.decent_fit, demerit: 0 };
}

function* breaks(nodes: ReadonlyNodes, hyphenate: boolean): Generator<Mark> {
  for (const [nidx, node] of nodes.entries()) {
    switch (node.type) {
      case "glue":
        yield { nidx };
        break;
      case "item":
        for (const [didx, disc] of node.discs.entries()) {
          // an empty suffix is an explicit hyphen, a break the first rung keeps
          if (hyphenate || !disc.suffix) yield { nidx, didx };
        }
        break;
    }
  }
  yield { nidx: nodes.length }; // the forced break that ends the paragraph
}

function natural({ stash, nodes, w }: Para, a: Mark, b: Mark): number {
  const src = nodes[a.nidx] as Item;
  const dst = nodes[b.nidx] as Item;
  if (a.nidx === b.nidx) return stash.get(fuse(src, a.didx!, b.didx!))!;
  let total = w[b.nidx] - w[a.nidx + 1]; // whole nodes lying strictly between the two breaks
  if (a.didx !== undefined) total += stash.get(fuse(src, a.didx, src.discs.length))!;
  if (b.didx !== undefined) total += stash.get(fuse(dst, -1, b.didx))!;
  return total;
}

function demerit({ nodes, s }: Para, a: Live, b: Mark, rung: Rung, width: number): Live | null {
  const last = b.nidx === nodes.length;
  const stretch = s[b.nidx] - s[a.mark.nidx + 1] + rung.emergency;
  const badness = last ? 0 : Knuth.badness(rung.lineWidth - width, stretch);
  if (badness > rung.tolerance) return null;
  const fitness = Knuth.fitness(badness);
  let demerit = a.demerit + (Knuth.line_penalty + badness) ** 2;
  if (b.didx !== undefined) demerit += penalty(nodes[b.nidx] as Item, b.didx) ** 2;
  if (Math.abs(fitness - a.fitness) > 1) demerit += Knuth.adj_demerits;
  if (a.mark.didx !== undefined && (b.didx !== undefined || last))
    demerit += last ? Knuth.final_hyphen_demerits : Knuth.double_hyphen_demerits;
  return { mark: b, prev: a, fitness, demerit };
}

function penalty(item: Item, i: number): number {
  return item.discs[i].suffix ? Knuth.hyphen_penalty : Knuth.ex_hyphen_penalty;
}

function retrace(end: Live): ReadonlyMarks {
  const marks: Mark[] = [];
  for (let n = end.prev; n?.prev; n = n.prev) {
    marks.push(n.mark);
  }
  return marks.reverse();
}

function minimum(picks: Live[]): Live {
  return picks.reduce((best, curr) => (curr.demerit < best.demerit ? curr : best));
}
