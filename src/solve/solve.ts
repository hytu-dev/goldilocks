import type { MeasuredToken, BreakOption } from "../measure";
import { TokenKind } from "../measure";

// output types ------------------------------------------------------------------------------------

// Reference to one BreakOption of one word token.
export interface BreakRef {
  tokenIndex: number;
  optionIndex: number;
}

// Description of a single typeset line.
export interface LineBreak {
  startToken: number; // first token index (inclusive)
  endToken: number; // last token index (inclusive)
  ratio: number; // inter-word spacing adjustment (0 = exact, >0 = stretch, <0 = shrink)
  startBreak?: BreakRef; // post-break fragment at line start
  endBreak?: BreakRef; // pre-break fragment at line end
}

export interface SolveResult {
  lines: LineBreak[];
}

// internal types ----------------------------------------------------------------------------------

// A position where a line may end (and the next one begin).
// Paragraph start is modeled as a virtual gap before token 0 ({ kind: "gap", tokenIndex: -1 }):
// "skip the whitespace, start at the next token" then covers it with no special case.
type BreakId =
  | { kind: "gap"; tokenIndex: number } // word boundary: break at this whitespace token
  | { kind: "hyphen"; tokenIndex: number; optionIndex: number } // discretionary break inside a word
  | { kind: "end" }; // forced paragraph end

type Hyphen = Extract<BreakId, { kind: "hyphen" }>;

enum Fitness {
  Tight,
  Normal,
  Loose,
  VeryLoose,
}

// A node in the active-breakpoint list: one feasible way of having broken the paragraph so far.
interface Node {
  breakId: BreakId;
  line: number;
  fitness: Fitness;
  demerits: number;
  prev: Node | null;
}

// Verdict of pairing one active node with one candidate breakpoint.
type BreakEval = { kind: "drop" } | { kind: "skip" } | { kind: "take"; node: Node };

// Natural width plus glue elasticity of a line.
interface Elastic {
  width: number;
  stretch: number;
  shrink: number;
}

// One side of a line: a prefix-sum boundary plus a fragment width the sums don't cover.
interface Edge {
  idx: number;
  adj: number;
}

interface PrefixSums {
  width: Float64Array;
  stretch: Float64Array;
  shrink: Float64Array;
}

interface Paragraph {
  tokens: readonly MeasuredToken[];
  prefixSum: PrefixSums;
  candidates: BreakId[];
}

// Everything constant within one kpPass; keeps per-line helper signatures on a single line.
interface PassContext {
  para: Paragraph;
  lineWidth: number;
  tolerance: number;
}

// constants ---------------------------------------------------------------------------------------

const TOLERANCE = 2; // acceptable range for |r| in the quality pass
const MAX_RATIO = 100; // ratio cap: keeps inelastic lines from out-scoring barely-elastic ones
const HYPHEN_PENALTY = 50; // demerit penalty for hyphenation breaks
const FITNESS_DEMERIT = 100; // extra demerits when adjacent lines differ by > 1 fitness class
const FLAGGED_DEMERIT = 100; // extra demerits for consecutive hyphenated lines

// interword glue elasticity as fractions of space width (TeX CM ratio: 1 : 1/2 : 1/3)
const STRETCH_FACTOR = 0.5;
const SHRINK_FACTOR = 1 / 3;

const SENTINEL: BreakId = { kind: "gap", tokenIndex: -1 };
const DROP: BreakEval = { kind: "drop" };
const SKIP: BreakEval = { kind: "skip" };

// public API --------------------------------------------------------------------------------------

/**
 * Break a measured paragraph into lines with the Knuth-Plass algorithm.
 * Runs a quality pass bounded by TOLERANCE first.
 * Then an emergency pass that accepts any line that is not overfull.
 * Returns null only when no legal layout exists at all.
 * e.g., some content cannot fit within `lineWidth` even at maximum shrink.
 */
export function solve(tokens: readonly MeasuredToken[], lineWidth: number): SolveResult | null {
  if (lastContentIndex(tokens) === -1) return { lines: [] }; // nothing typesettable
  const para = prepare(tokens);
  const winner = kpPass(para, lineWidth, TOLERANCE) ?? kpPass(para, lineWidth, Infinity);
  return winner === null ? null : traceBack(winner, para, lineWidth);
}

// preparation -------------------------------------------------------------------------------------

function prepare(tokens: readonly MeasuredToken[]): Paragraph {
  return { tokens, prefixSum: buildPrefixSums(tokens), candidates: enumerateCandidates(tokens) };
}

function buildPrefixSums(tokens: readonly MeasuredToken[]): PrefixSums {
  const width = new Float64Array(tokens.length + 1);
  const stretch = new Float64Array(tokens.length + 1);
  const shrink = new Float64Array(tokens.length + 1);
  for (let i = 0; i < tokens.length; ++i) {
    const isGlue = tokens[i].kind === TokenKind.Whitespace;
    width[i + 1] = width[i] + tokens[i].width;
    stretch[i + 1] = stretch[i] + (isGlue ? tokens[i].width * STRETCH_FACTOR : 0);
    shrink[i + 1] = shrink[i] + (isGlue ? tokens[i].width * SHRINK_FACTOR : 0);
  }
  return { width, stretch, shrink };
}

function enumerateCandidates(tokens: readonly MeasuredToken[]): BreakId[] {
  const lastContent = lastContentIndex(tokens);
  const breaks: BreakId[] = [];
  let seenContent = false;
  for (let i = 0; i < tokens.length; ++i) {
    if (tokens[i].kind === TokenKind.Whitespace) {
      // one gap per whitespace run, strictly between content;
      // edge gaps would manufacture empty lines, run duplicates identical nodes
      const runStart = tokens[i - 1]?.kind !== TokenKind.Whitespace;
      if (seenContent && i < lastContent && runStart) breaks.push({ kind: "gap", tokenIndex: i });
      continue;
    }
    seenContent = true;
    if (tokens[i].kind !== TokenKind.Word || !tokens[i].breakOptions) continue;
    for (let j = 0; j < tokens[i].breakOptions!.length; ++j) {
      breaks.push({ kind: "hyphen", tokenIndex: i, optionIndex: j });
    }
  }
  breaks.push({ kind: "end" });
  return breaks;
}

function lastContentIndex(tokens: readonly MeasuredToken[]): number {
  for (let i = tokens.length - 1; i >= 0; --i) {
    if (tokens[i].kind !== TokenKind.Whitespace) return i;
  }
  return -1;
}

// dynamic programming -----------------------------------------------------------------------------

function kpPass(para: Paragraph, lineWidth: number, tolerance: number): Node | null {
  const ctx: PassContext = { para, lineWidth, tolerance };
  let active: Node[] = [sentinelNode()];
  for (const candidate of para.candidates) {
    active = relaxCandidate(ctx, active, candidate);
    if (active.length === 0) return null; // every path became overfull: this pass fails
  }
  return pickWinner(active);
}

function sentinelNode(): Node {
  return { breakId: SENTINEL, line: 0, fitness: Fitness.Normal, demerits: 0, prev: null };
}

// Evaluate one candidate against every active node, keeping the best new node per fitness class.
function relaxCandidate(ctx: PassContext, active: Node[], candidate: BreakId): Node[] {
  const best: (Node | null)[] = [null, null, null, null]; // one slot per Fitness class
  const survivors: Node[] = [];
  for (const node of active) {
    const result = tryBreak(ctx, node, candidate);
    if (result.kind !== "drop") survivors.push(node);
    if (result.kind !== "take") continue;
    const made = result.node;
    const incumbent = best[made.fitness];
    if (incumbent === null || made.demerits < incumbent.demerits) best[made.fitness] = made;
  }
  for (const node of best) if (node !== null) survivors.push(node);
  return survivors;
}

// Decide what breaking at `candidate`, coming from `node`, means for the active list.
function tryBreak(ctx: PassContext, node: Node, candidate: BreakId): BreakEval {
  if (sameWordBreaks(node.breakId, candidate)) return SKIP; // a line can't live inside one word
  const metrics = lineMetrics(ctx.para, node.breakId, candidate);
  const ratio = lastLineAwareRatio(metrics, candidate, ctx.lineWidth);
  if (ratio < -1) return DROP; // overfull now, and lines from here only grow — node is dead
  if (ratio > ctx.tolerance) return SKIP; // too loose for this pass; later candidates may fit
  return { kind: "take", node: makeNode(candidate, node, ratio) };
}

function sameWordBreaks(a: BreakId, b: BreakId): boolean {
  return a.kind === "hyphen" && b.kind === "hyphen" && a.tokenIndex === b.tokenIndex;
}

function makeNode(candidate: BreakId, prev: Node, ratio: number): Node {
  const fitness = classifyFitness(ratio);
  const demerits = computeDemerits(ratio, fitness, candidate, prev);
  return { breakId: candidate, line: prev.line + 1, fitness, demerits, prev };
}

// Among all complete layouts, keep the one with minimal total demerits.
function pickWinner(active: Node[]): Node | null {
  let winner: Node | null = null;
  for (const node of active) {
    if (node.breakId.kind !== "end") continue;
    if (winner === null || node.demerits < winner.demerits) winner = node;
  }
  return winner;
}

// line geometry -----------------------------------------------------------------------------------

// Natural width and glue elasticity of the line spanning breaks (a, b], via prefix-sum difference.
function lineMetrics(para: Paragraph, a: BreakId, b: BreakId): Elastic {
  const start = startEdge(para, a);
  const end = endEdge(para, b);
  const { width, stretch, shrink } = para.prefixSum;
  return {
    width: width[end.idx] - width[start.idx] + start.adj + end.adj,
    stretch: stretch[end.idx] - stretch[start.idx],
    shrink: shrink[end.idx] - shrink[start.idx],
  };
}

function startEdge(para: Paragraph, a: BreakId): Edge {
  if (a.kind === "gap") return { idx: firstContentFrom(para, a.tokenIndex + 1), adj: 0 };
  if (a.kind === "hyphen") return { idx: a.tokenIndex + 1, adj: optionOf(para, a).postBreakWidth };
  return unreachable("paragraph end cannot start a line");
}

function endEdge(para: Paragraph, b: BreakId): Edge {
  if (b.kind === "end") return { idx: lastContentBefore(para, para.tokens.length), adj: 0 };
  if (b.kind === "hyphen") return { idx: b.tokenIndex, adj: optionOf(para, b).preBreakWidth };
  return { idx: lastContentBefore(para, b.tokenIndex), adj: 0 };
}

// Lines never begin or end with whitespace: edges slide past whitespace runs (covers the
// sentinel skipping leading whitespace and the paragraph end dropping trailing whitespace).
function firstContentFrom(para: Paragraph, idx: number): number {
  const { tokens } = para;
  while (idx < tokens.length && tokens[idx].kind === TokenKind.Whitespace) ++idx;
  return idx;
}

function lastContentBefore(para: Paragraph, idx: number): number {
  const { tokens } = para;
  while (idx > 0 && tokens[idx - 1].kind === TokenKind.Whitespace) --idx;
  return idx;
}

// Hyphen BreakIds are only ever created from existing breakOptions, hence the assertion.
function optionOf(para: Paragraph, h: Hyphen): BreakOption {
  return para.tokens[h.tokenIndex].breakOptions![h.optionIndex];
}

// scoring -----------------------------------------------------------------------------------------

// The last line is ragged: any underfull width is fine (ratio 0); only overfull needs shrinking.
// Consequence: "end" never yields ratio > 0, so the tolerance check never rejects it.
function lastLineAwareRatio(metrics: Elastic, bp: BreakId, lineWidth: number): number {
  if (bp.kind === "end" && metrics.width <= lineWidth) return 0;
  return adjustmentRatio(metrics.width, metrics.stretch, metrics.shrink, lineWidth);
}

// >0 = stretch, <0 = shrink; capped at ±MAX_RATIO so ratios stay monotone in line quality.
function adjustmentRatio(natural: number, stretch: number, shrink: number, target: number): number {
  const diff = target - natural;
  if (diff > 0) return stretch > 0 ? Math.min(diff / stretch, MAX_RATIO) : MAX_RATIO;
  if (diff < 0) return shrink > 0 ? Math.max(diff / shrink, -MAX_RATIO) : -MAX_RATIO;
  return 0;
}

function classifyFitness(ratio: number): Fitness {
  if (ratio < -0.5) return Fitness.Tight;
  if (ratio < 0.5) return Fitness.Normal;
  if (ratio < 1) return Fitness.Loose;
  return Fitness.VeryLoose;
}

// TeX-style demerits: quadratic in badness, plus penalties for uneven rhythm and hyphen runs.
function computeDemerits(ratio: number, fitness: Fitness, candidate: BreakId, prev: Node): number {
  const penalty = candidate.kind === "hyphen" ? HYPHEN_PENALTY : 0;
  let demerits = (1 + badness(ratio) + penalty) ** 2;
  if (Math.abs(fitness - prev.fitness) > 1) demerits += FITNESS_DEMERIT;
  if (candidate.kind === "hyphen" && prev.breakId.kind === "hyphen") demerits += FLAGGED_DEMERIT;
  return demerits + prev.demerits;
}

function badness(ratio: number): number {
  const abs = Math.abs(ratio);
  return Math.round(100 * abs * abs * abs);
}

// output ------------------------------------------------------------------------------------------

function traceBack(endNode: Node, para: Paragraph, lineWidth: number): SolveResult {
  const lines: LineBreak[] = [];
  let prev: BreakId = SENTINEL;
  for (const node of collectChain(endNode)) {
    lines.push(buildLine(para, prev, node.breakId, lineWidth));
    prev = node.breakId;
  }
  return { lines };
}

// Chosen breakpoints in paragraph order, sentinel excluded.
function collectChain(endNode: Node): Node[] {
  const chain: Node[] = [];
  let cur: Node | null = endNode;
  while (cur !== null && cur.prev !== null) {
    chain.push(cur);
    cur = cur.prev;
  }
  return chain.reverse();
}

function buildLine(para: Paragraph, prev: BreakId, bp: BreakId, lineWidth: number): LineBreak {
  const metrics = lineMetrics(para, prev, bp);
  const ratio = lastLineAwareRatio(metrics, bp, lineWidth);
  return { ...lineSpan(para, prev, bp), ratio };
}

function lineSpan(para: Paragraph, prev: BreakId, bp: BreakId): Omit<LineBreak, "ratio"> {
  const span: Omit<LineBreak, "ratio"> = {
    startToken: startTokenOf(para, prev),
    endToken: endTokenOf(para, bp),
  };
  if (prev.kind === "hyphen") span.startBreak = breakRef(prev);
  if (bp.kind === "hyphen") span.endBreak = breakRef(bp);
  return span;
}

function startTokenOf(para: Paragraph, prev: BreakId): number {
  if (prev.kind === "gap") return firstContentFrom(para, prev.tokenIndex + 1);
  if (prev.kind === "hyphen") return prev.tokenIndex; // line begins with the post-break fragment
  return unreachable("paragraph end cannot start a line");
}

function endTokenOf(para: Paragraph, bp: BreakId): number {
  if (bp.kind === "end") return lastContentBefore(para, para.tokens.length) - 1;
  if (bp.kind === "hyphen") return bp.tokenIndex; // line ends with the pre-break fragment
  return lastContentBefore(para, bp.tokenIndex) - 1;
}

function breakRef(h: Hyphen): BreakRef {
  return { tokenIndex: h.tokenIndex, optionIndex: h.optionIndex };
}

// utilities ---------------------------------------------------------------------------------------

function unreachable(msg: string): never {
  throw new Error(`solver invariant violated: ${msg}`);
}
