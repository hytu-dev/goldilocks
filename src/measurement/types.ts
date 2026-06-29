export const enum TokenKind {
  Word,
  Whitespace,
  Punctuation,
}

export interface Token {
  kind: TokenKind;
  text: string;
  start: number; // inclusive offset in the source string
  end: number; // exclusive offset in the source string
}

export interface BreakOption {
  position: number; // index in the word where the break falls
  preBreakWidth: number; // pre-break fragment including the hyphen glyph, e.g. "in-"
  postBreakWidth: number; // post-break fragment, e.g. "formation"
}

export interface MeasuredToken extends Token {
  width: number; // full word/token width
  breakOptions?: BreakOption[]; // present only when tokens are hyphenatable
}
