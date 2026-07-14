import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenize";
import { TokenKind } from "./types";

function kinds(text: string): TokenKind[] {
  return tokenize(text).map((t) => t.kind);
}

function texts(text: string): string[] {
  return tokenize(text).map((t) => t.text);
}

// Basic splitting --------------------------------------------------------------------------------
// Verify the tokenizer segments prose into the expected token sequence.
describe("basic splitting", () => {
  it("simple sentence", () => {
    expect(texts("hello world")).toEqual(["hello", " ", "world"]);
  });

  it("sentence with punctuation", () => {
    expect(texts("Hello, world!")).toEqual(["Hello", ",", " ", "world", "!"]);
  });

  it("multiple spaces between words", () => {
    expect(texts("a   b")).toEqual(["a", "   ", "b"]);
  });

  it("leading and trailing whitespace", () => {
    expect(texts("  hi  ")).toEqual(["  ", "hi", "  "]);
  });

  it("tab and newline are whitespace", () => {
    expect(texts("a\tb\nc")).toEqual(["a", "\t", "b", "\n", "c"]);
  });

  it("mixed whitespace splits per character", () => {
    expect(texts("a \t\n b")).toEqual(["a", " ", "\t", "\n", " ", "b"]);
  });
});

// Classification ---------------------------------------------------------------------------------
// Each token must be classified as Word, Whitespace, or Punctuation.
describe("classification", () => {
  it("letters are Word", () => {
    expect(kinds("hello")).toEqual([TokenKind.Word]);
  });

  it("digits are Word", () => {
    expect(kinds("42")).toEqual([TokenKind.Word]);
  });

  it("mixed letters and digits are one Word", () => {
    expect(kinds("h1b")).toEqual([TokenKind.Word]);
  });

  it("spaces are Whitespace", () => {
    expect(kinds("   ")).toEqual([TokenKind.Whitespace]);
  });

  it("comma is Punctuation", () => {
    expect(kinds(",")).toEqual([TokenKind.Punctuation]);
  });

  it("each punctuation char is a separate token", () => {
    expect(kinds("...")).toEqual([
      TokenKind.Punctuation,
      TokenKind.Punctuation,
      TokenKind.Punctuation,
    ]);
  });

  it("em dash is Punctuation", () => {
    expect(kinds("\u2014")).toEqual([TokenKind.Punctuation]);
  });

  it("hyphen is Punctuation", () => {
    expect(kinds("-")).toEqual([TokenKind.Punctuation]);
  });
});

// Apostrophes ------------------------------------------------------------------------------------
// Apostrophes bind to words — contractions and possessives stay as one token.
describe("apostrophes", () => {
  it("contraction stays as one token", () => {
    expect(texts("don't")).toEqual(["don't"]);
  });

  it("possessive stays as one token", () => {
    expect(texts("cat's")).toEqual(["cat's"]);
  });

  it("leading apostrophe is separate punctuation", () => {
    expect(texts("'twas")).toEqual(["'", "twas"]);
  });
});

// Edge cases -------------------------------------------------------------------------------------
describe("edge cases", () => {
  it("empty string returns no tokens", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("single letter", () => {
    const tokens = tokenize("a");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(TokenKind.Word);
  });

  it("single space", () => {
    const tokens = tokenize(" ");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(TokenKind.Whitespace);
  });

  it("single punctuation mark", () => {
    const tokens = tokenize("!");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(TokenKind.Punctuation);
  });
});

// Offset correctness -----------------------------------------------------------------------------
// start/end offsets must reconstruct the original text with no gaps or overlaps.
describe("offset correctness", () => {
  const inputs = ["The quick, brown fox\u2014jumps!", "  spaced  out  ", "don't stop", ""];

  for (const input of inputs) {
    describe(`"${input}"`, () => {
      const tokens = tokenize(input);

      it("concatenated texts equal original", () => {
        expect(tokens.map((t) => t.text).join("")).toBe(input);
      });

      it("each token's text matches slice by its offsets", () => {
        for (const t of tokens) {
          expect(input.slice(t.start, t.end)).toBe(t.text);
        }
      });

      it("offsets cover the full string with no gaps", () => {
        if (tokens.length === 0) return;
        expect(tokens[0].start).toBe(0);
        expect(tokens[tokens.length - 1].end).toBe(input.length);
        for (let i = 1; i < tokens.length; i++) {
          expect(tokens[i].start).toBe(tokens[i - 1].end);
        }
      });
    });
  }
});
