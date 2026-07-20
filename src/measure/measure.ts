import { nodify } from "../nodify/nodify";
import { TokenKind, type Token, type BreakOption, type MeasuredToken } from "./types";

type H = (word: string) => number[];

/**
 * Measure every token in a Text node, including hyphenation break widths.
 * @param textNode The light-DOM Text node projected through the slot.
 * @param container Temporary shadow-DOM measurement container (offscreen, nowrap).
 * @param hyphenate Returns valid break-point offsets for a word.
 * @returns Tokens with measured widths; word tokens may include hyphenation break options.
 */
export function measure(textNode: Text, container: HTMLElement, hyphenate: H): MeasuredToken[] {
  const text = textNode.textContent ?? "";
  if (text.length === 0) return [];

  const tokens = tokenize(text);
  const measured = measureTokenWidths(textNode, tokens);
  applyHyphenation(measured, container, hyphenate);

  return measured;
}

// helpers ----------------------------------------------------------------------------------------

function measureTokenWidths(textNode: Text, tokens: Token[]): MeasuredToken[] {
  const widthCache = new Map<string, number>();
  const range = textNode.ownerDocument.createRange();
  return tokens.map((token) => {
    const cached = widthCache.get(token.text);
    if (cached !== undefined) return { ...token, width: cached };
    range.setStart(textNode, token.start);
    range.setEnd(textNode, token.end);
    const width = range.getBoundingClientRect().width;
    widthCache.set(token.text, width);
    return { ...token, width };
  });
}

function applyHyphenation(tokens: MeasuredToken[], container: HTMLElement, hyphenate: H): void {
  const words = collectBreakOptions(tokens, hyphenate);
  if (words.size === 0) return;
  batchMeasureBreakOptions(words, container);
  distributeBreakOptions(tokens, words);
}

interface WordEntry {
  breakOptions: BreakOption[];
}

function collectBreakOptions(tokens: MeasuredToken[], hyphenate: H): Map<string, WordEntry> {
  const map = new Map<string, WordEntry>();
  for (const token of tokens) {
    if (token.kind !== TokenKind.Word) continue;
    if (map.has(token.text)) continue;
    const breakPoints = hyphenate(token.text);
    if (breakPoints.length === 0) continue;
    const breakOptions: BreakOption[] = breakPoints.map((pos) => ({
      position: pos,
      preBreakWidth: 0,
      postBreakWidth: 0,
    }));
    map.set(token.text, { breakOptions });
  }
  return map;
}

interface SpanJob {
  option: BreakOption;
  target: "preBreakWidth" | "postBreakWidth";
  text: string;
}

function buildSpanJobs(words: Map<string, WordEntry>): SpanJob[] {
  const jobs: SpanJob[] = [];
  for (const [word, entry] of words) {
    for (const option of entry.breakOptions) {
      jobs.push({
        option,
        target: "preBreakWidth",
        text: word.slice(0, option.position) + "-",
      });
      jobs.push({
        option,
        target: "postBreakWidth",
        text: word.slice(option.position),
      });
    }
  }
  return jobs;
}

function batchMeasureBreakOptions(words: Map<string, WordEntry>, container: HTMLElement): void {
  const jobs = buildSpanJobs(words);
  const spans: HTMLSpanElement[] = new Array(jobs.length);
  for (let j = 0; j < jobs.length; ++j) {
    const span = container.ownerDocument.createElement("span");
    span.textContent = jobs[j].text;
    spans[j] = span;
    container.appendChild(span);
  }
  for (let j = 0; j < jobs.length; ++j) {
    const job = jobs[j];
    job.option[job.target] = spans[j].getBoundingClientRect().width;
  }
  container.textContent = "";
}

function distributeBreakOptions(tokens: MeasuredToken[], words: Map<string, WordEntry>): void {
  for (const token of tokens) {
    if (token.kind !== TokenKind.Word) continue;
    const entry = words.get(token.text);
    if (!entry) continue;
    // Each token needs its own copy; solver may mutate break options per-occurrence.
    token.breakOptions = entry.breakOptions.map((option) => ({ ...option }));
  }
}
