// Knuth-Plass line breaking with TeX's demerits model (tex.web 813-890).
// Whole-node widths live on the nodes; fragment widths for discretionary breaks come from the
// measure cache, because kerning makes fragments non-additive:
// w("in-") + w("formation") != w("information").
// There is no shrink anywhere: NBSP does not compress, so an overfull line is simply infeasible.

import { type Item, segment, type TeXNode } from "../defs.ts";

const LINE_PENALTY = 10; // \linepenalty
const HYPHEN_PENALTY = 50; // \hyphenpenalty
const EX_HYPHEN_PENALTY = 50; // \exhyphenpenalty
const ADJ_DEMERITS = 10000; // \adjdemerits
const DOUBLE_HYPHEN_DEMERITS = 10000; // \doublehyphendemerits
const FINAL_HYPHEN_DEMERITS = 5000; // \finalhyphendemerits
const INF_BADNESS = 10000; // inf_bad
const TOLERANCE = 200; // \tolerance

// Fitness classes, numbered as in TeX: new active nodes enter the list in this order, which decides
// ties. TIGHT is unreachable without shrink.
const VERY_LOOSE = 0;
const LOOSE = 1;
const DECENT = 2; // TIGHT = 3

export interface Break {
  node: number; // index into the node list
  disc?: number; // index into that Item's discs; absent means the break falls on a Glue
}

export interface SolveOptions {
  tolerance?: number; // badness ceiling for a feasible line (\pretolerance, then \tolerance)
  emergencyStretch?: number; // scoring-only stretch granted to every line (\emergencystretch)
}

interface Pass {
  nodes: readonly TeXNode[];
  cache: ReadonlyMap<string, number>;
  w: number[]; // prefix sums of node widths
  y: number[]; // prefix sums of glue stretch
  lineWidth: number;
  tolerance: number;
  emergencyStretch: number;
}

interface Active {
  at: Break;
  fitness: number;
  hyphen: boolean; // the line ending here ends at a disc, for \doublehyphendemerits
  demerits: number; // total demerits of the best path reaching this break
  prev: Active | null;
}

/**
 * Break a measured paragraph into lines. This is a single KP pass; the caller escalates
 * pretolerance -> tolerance -> emergencystretch, because the first escalation also has to re-run
 * nodify and measure to bring discs into existence.
 * Returns null when no arrangement is feasible, which for the last pass means the paragraph cannot
 * be set at this width at all and native wrapping should take over.
 */
export function solve(
  nodes: readonly TeXNode[],
  cache: ReadonlyMap<string, number>,
  lineWidth: number,
  { tolerance = TOLERANCE, emergencyStretch = 0 }: SolveOptions = {},
): Break[] | null {
  if (nodes.length === 0) return [];

  const pass: Pass = {
    nodes,
    cache,
    ...prefixSums(nodes),
    lineWidth,
    tolerance,
    emergencyStretch,
  };

  // The origin sits before node 0 so that w[at.node + 1] is w[0] with no special case.
  let actives: Active[] = [
    { at: { node: -1 }, fitness: DECENT, hyphen: false, demerits: 0, prev: null },
  ];

  for (const b of breakpoints(nodes)) {
    const survivors: Active[] = [];
    const best: (Active | null)[] = [null, null, null, null];

    for (const a of actives) {
      const width = natural(pass, a.at, b);
      // Widths are positive, so a line that already overflows can only get worse at later breaks.
      // A disc's pre-text can in principle be wider than the letters it replaces, which makes this
      // pruning marginally lossy; TeX prunes the same way for the same reason.
      if (width > lineWidth) continue;
      survivors.push(a);

      const found = tryBreak(pass, a, b, width);
      if (!found) continue;
      // One survivor per fitness class: a costlier predecessor in another class can still win
      // later, because \adjdemerits scores the *pair* of adjacent lines. TeX breaks ties in favour
      // of the later candidate (tex.web 855), hence <= rather than <.
      const incumbent = best[found.fitness];
      if (!incumbent || found.demerits <= incumbent.demerits) best[found.fitness] = found;
    }

    const created = best.filter((n) => n !== null);
    if (b.node === nodes.length) return created.length ? trace(cheapest(created)) : null;

    actives = [...survivors, ...created];
    if (actives.length === 0) return null; // nothing left that can reach the end
  }

  return null; // unreachable: breakpoints() always ends with the forced break
}

// helpers -----------------------------------------------------------------------------------------

function prefixSums(nodes: readonly TeXNode[]): { w: number[]; y: number[] } {
  const w = [0];
  const y = [0];
  for (const [i, node] of nodes.entries()) {
    const stretch = node.type === "glue" ? node.stretch : 0;
    if (node.width === undefined || stretch === undefined)
      throw new Error(`solve: node ${i} was not measured`);
    w.push(w[i] + node.width);
    y.push(y[i] + stretch);
  }
  return { w, y };
}

function* breakpoints(nodes: readonly TeXNode[]): Generator<Break> {
  for (const [i, node] of nodes.entries()) {
    if (node.type === "glue") yield { node: i };
    else if (node.discs) for (const d of node.discs.keys()) yield { node: i, disc: d };
  }
  yield { node: nodes.length }; // the forced break that ends the paragraph
}

/** Natural width of the line running from break `a` to break `b`. */
function natural(p: Pass, a: Break, b: Break): number {
  // A break carrying `disc` is by construction inside an Item, and the two Items below are only
  // dereferenced on exactly those branches.
  const from = p.nodes[a.node] as Item;
  const to = p.nodes[b.node] as Item;

  // Same index means both ends are discs of one word: the line is a single middle fragment, "for-".
  if (a.node === b.node) return fragment(p, segment(from, a.disc, b.disc));

  let total = p.w[b.node] - p.w[a.node + 1]; // whole nodes lying strictly between the breaks
  if (a.disc !== undefined) total += fragment(p, segment(from, a.disc)); // tail of a broken word
  if (b.disc !== undefined) total += fragment(p, segment(to, undefined, b.disc)); // head of one
  return total;
}

function fragment(p: Pass, seg: string): number {
  const width = p.cache.get(seg);
  // A miss means solve and measure disagree on how fragments are spelled. Never guess a width.
  if (width === undefined) throw new Error(`solve: unmeasured fragment ${JSON.stringify(seg)}`);
  return width;
}

/** Score the line from `a` to `b`, or reject it as too loose. */
function tryBreak(p: Pass, a: Active, b: Break, width: number): Active | null {
  const last = b.node === p.nodes.length;
  const stretch = p.y[b.node] - p.y[a.at.node + 1] + p.emergencyStretch;

  // \parfillskip stretches infinitely, so the last line is always a perfect fit.
  const badness = last ? 0 : badnessOf(p.lineWidth - width, stretch);
  if (badness > p.tolerance) return null;

  const fitness = fitnessOf(badness);
  const hyphen = b.disc !== undefined;

  let demerits = a.demerits + (LINE_PENALTY + badness) ** 2;
  // The forced final break contributes no penalty term. An empty pre marks an explicit hyphen,
  // which is exactly how TeX tells the two penalties apart (tex.web 869).
  if (hyphen) demerits += penaltyOf(p.nodes[b.node] as Item, b.disc as number) ** 2;
  if (Math.abs(fitness - a.fitness) > 1) demerits += ADJ_DEMERITS;
  // TeX charges these only when the current break is hyphenated, and treats the forced break at the
  // end of the paragraph as hyphenated for exactly this rule.
  if (a.hyphen && (hyphen || last))
    demerits += last ? FINAL_HYPHEN_DEMERITS : DOUBLE_HYPHEN_DEMERITS;

  return { at: b, fitness, hyphen, demerits, prev: a };
}

function penaltyOf(item: Item, disc: number): number {
  return item.discs?.[disc].pre ? HYPHEN_PENALTY : EX_HYPHEN_PENALTY;
}

function badnessOf(t: number, s: number): number {
  if (t === 0) return 0;
  if (s <= 0) return INF_BADNESS; // short line with nothing to stretch
  // tex.web 108, verbatim: an integer approximation of 100*(t/s)^3 with its own truncations.
  const r =
    t <= 7230584
      ? Math.floor((t * 297) / s)
      : s >= 1663497
        ? Math.floor(t / Math.floor(s / 297))
        : t;
  return r > 1290 ? INF_BADNESS : Math.floor((r * r * r + 131072) / 262144);
}

// tex.web 852 classifies by badness, not by the adjustment ratio. The two only agree approximately,
// and a line sitting exactly on badness 12 is where they part company.
function fitnessOf(badness: number): number {
  return badness > 99 ? VERY_LOOSE : badness > 12 ? LOOSE : DECENT;
}

function cheapest(candidates: Active[]): Active {
  return candidates.reduce((best, n) => (n.demerits < best.demerits ? n : best));
}

/** Walk back from the forced final break, dropping both sentinels. */
function trace(end: Active): Break[] {
  const breaks: Break[] = [];
  for (let n = end.prev; n?.prev; n = n.prev) breaks.push(n.at);
  return breaks.reverse();
}
