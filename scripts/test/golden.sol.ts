import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Item, segment, type TeXNode } from "../../src/defs.ts";
import { nodify } from "../../src/nodify/index.ts";
import { type Break, solve } from "../../src/solve/index.ts";

const PRETOLERANCE = 100; // \pretolerance
const TOLERANCE = 200; // \tolerance

const ROOT = resolve(import.meta.dirname, "../..");
const OUTPUT = resolve(ROOT, "fixtures/mismatches.sol");
const metrics = readMetrics(readFileSync(resolve(ROOT, "fixtures/metrics.sol"), "utf-8"));
const cases = readFileSync(resolve(ROOT, "fixtures/golden.sol"), "utf-8").trimEnd().split("\n");

const mismatches: Mismatch[] = [];
const tally = { 1: 0, 2: 0, 3: 0, forced: 0, skipped: 0 };

for (const line of cases) {
  const [paragraph, hsize, emergency, flag, expected] = line.split("\t");
  const result = layout(paragraph, Number(hsize), Number(emergency));

  // A glyph the font does not carry leaves no node, so TeX and nodify disagree on the text itself
  // and there is nothing meaningful to compare.
  if (result.kind === "skipped") {
    tally.skipped++;
    continue;
  }

  const actual = result.kind === "none" ? "" : result.lines.join("|");
  const want = flag === "forced" ? "" : expected;
  if (actual === want) {
    if (flag === "forced") tally.forced++;
    else if (result.kind !== "none") tally[result.pass]++;
    continue;
  }
  mismatches.push({ paragraph, hsize, expected: want, actual });
}

console.log(
  `pass1 ${tally[1]}  pass2 ${tally[2]}  pass3 ${tally[3]}  ` +
    `forced ${tally.forced}  skipped ${tally.skipped}  mismatched ${mismatches.length}`,
);

if (existsSync(OUTPUT)) unlinkSync(OUTPUT);
if (mismatches.length === 0) process.exit(0);

const report = mismatches.map((m) => `${m.paragraph}\t${m.hsize}\t${m.expected}\t${m.actual}`);
writeFileSync(OUTPUT, `${report.join("\n")}\n`);
process.exit(1);

// helpers -----------------------------------------------------------------------------------------

/** The escalation component.ts performs: no hyphens, then hyphens, then emergency stretch. */
function layout(text: string, width: number, emergency: number): Result {
  const plain = nodify(text, false);
  const flat = price(plain);
  if (flat === null) return SKIPPED;
  const first = solve(plain, flat, width, { tolerance: PRETOLERANCE });
  if (first) return { kind: "laid", pass: 1, lines: render(plain, first) };

  const broken = nodify(text, true);
  const cache = price(broken);
  if (cache === null) return SKIPPED;
  const second = solve(broken, cache, width, { tolerance: TOLERANCE });
  if (second) return { kind: "laid", pass: 2, lines: render(broken, second) };

  const opts = { tolerance: TOLERANCE, emergencyStretch: emergency };
  const third = solve(broken, cache, width, opts);
  if (third) return { kind: "laid", pass: 3, lines: render(broken, third) };
  return { kind: "none" };
}

/**
 * Stand in for measure(): fill the node widths and build the fragment cache from the font metrics.
 * Ligatures and kerns are disabled in the golden, so any run of glyphs costs the sum of its
 * characters and every fragment can be priced from its own text.
 */
function price(nodes: TeXNode[]): Map<string, number> | null {
  const cache = new Map<string, number>();
  for (const node of nodes) {
    if (node.type === "glue") {
      node.width = metrics.space;
      node.stretch = metrics.stretch;
      continue;
    }
    const width = textWidth(node.text);
    if (width === null) return null;
    node.width = width;
    if (!node.discs) continue;

    const cuts = node.discs.map((_, i) => i);
    for (const from of [undefined, ...cuts]) {
      for (const to of [...cuts, undefined]) {
        if (from === undefined ? to === undefined : to !== undefined && to <= from) continue;
        const fragment = segment(node, from, to);
        const size = textWidth(fragment);
        if (size === null) return null;
        cache.set(fragment, size);
      }
    }
  }
  return cache;
}

function textWidth(text: string): number | null {
  let total = 0;
  for (const char of text) {
    const width = metrics.chars.get(char);
    if (width === undefined) return null;
    total += width;
  }
  return total;
}

/** The visible text of each line, which is what TeX's own line boxes hold. */
function render(nodes: readonly TeXNode[], breaks: Break[]): string[] {
  const lines: string[] = [];
  let a: Break = { node: -1 };
  for (const b of [...breaks, { node: nodes.length }]) {
    const from = nodes[a.node] as Item;
    if (a.node === b.node) {
      lines.push(segment(from, a.disc, b.disc));
      a = b;
      continue;
    }
    let text = a.disc === undefined ? "" : segment(from, a.disc);
    for (let i = a.node + 1; i < b.node; i++) {
      const node = nodes[i];
      if (node.type === "item") text += node.text;
    }
    if (b.disc !== undefined) text += segment(nodes[b.node] as Item, undefined, b.disc);
    lines.push(text);
    a = b;
  }
  return lines;
}

function readMetrics(source: string): Metrics {
  const chars = new Map<string, number>();
  let space = 0;
  let stretch = 0;
  for (const line of source.trimEnd().split("\n")) {
    const [kind, a, b] = line.split("\t");
    if (kind === "G") [space, stretch] = [Number(a), Number(b)];
    else chars.set(String.fromCodePoint(Number(a)), Number(b));
  }
  return { chars, space, stretch };
}

interface Metrics {
  chars: Map<string, number>;
  space: number;
  stretch: number;
}

type Result =
  | { kind: "laid"; pass: 1 | 2 | 3; lines: string[] }
  | { kind: "none" }
  | { kind: "skipped" };

const SKIPPED: Result = { kind: "skipped" };

interface Mismatch {
  paragraph: string;
  hsize: string;
  expected: string;
  actual: string;
}
