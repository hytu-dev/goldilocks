import { TokenKind, type Token } from "./types";

const WORD_RE = /[\p{L}\p{N}']/u;
const WHITESPACE_RE = /^\s+$/;
const TOKEN_RE = /[\p{L}\p{N}']+|\s+|[^\p{L}\p{N}'\s]/gu;

/**
 * Split text into word, whitespace, and punctuation tokens with source offsets.
 * @param text The raw text content of a Text node.
 * @returns Tokens preserving original offsets for Range-based measurement.
 */
export function tokenize(text: string): Token[] {
  return [...text.matchAll(TOKEN_RE)].map((match) => ({
    kind: classifyToken(match[0]),
    text: match[0],
    start: match.index!,
    end: match.index! + match[0].length,
  }));
}

// helper -----------------------------------------------------------------------------------------

function classifyToken(raw: string): TokenKind {
  if (WHITESPACE_RE.test(raw)) return TokenKind.Whitespace;
  if (raw.length === 1 && !WORD_RE.test(raw)) return TokenKind.Punctuation;
  return TokenKind.Word;
}
