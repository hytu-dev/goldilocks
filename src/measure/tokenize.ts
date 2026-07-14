import { TokenKind, type Token } from "./types";

const segmenter = new Intl.Segmenter("en", { granularity: "word" });
const WHITESPACE_RE = /^\s+$/;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const { segment, index, isWordLike } of segmenter.segment(text)) {
    tokens.push({
      kind: classifySegment(segment, isWordLike ?? false),
      text: segment,
      start: index,
      end: index + segment.length,
    });
  }
  return tokens;
}

function classifySegment(segment: string, isWordLike: boolean): TokenKind {
  if (isWordLike) return TokenKind.Word;
  if (WHITESPACE_RE.test(segment)) return TokenKind.Whitespace;
  return TokenKind.Punctuation;
}
