import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { measure } from "./measure";
import { TokenKind } from "./types";

// Test fixtures ----------------------------------------------------------------------------------

let host: HTMLDivElement;
let container: HTMLDivElement;

// Monospace font ensures character-proportional widths.
const FONT_STYLE = "16px monospace";

function createTextNode(text: string): Text {
  const node = document.createTextNode(text);
  host.appendChild(node);
  return node;
}

// Stub: no word is hyphenatable.
const noHyphenation = () => [] as number[];

beforeEach(() => {
  host = document.createElement("div");
  host.style.font = FONT_STYLE;
  host.style.position = "absolute";
  host.style.whiteSpace = "nowrap";
  document.body.appendChild(host);

  // Mirrors the Shadow DOM measurement container: offscreen, nowrap, same font.
  container = document.createElement("div");
  container.style.font = FONT_STYLE;
  container.style.position = "absolute";
  container.style.visibility = "hidden";
  container.style.whiteSpace = "nowrap";
  document.body.appendChild(container);
});

afterEach(() => {
  host.remove();
  container.remove();
});

// Basic measurement ------------------------------------------------------------------------------
describe("basic measurement", () => {
  it("returns one token per tokenized segment", () => {
    const node = createTextNode("hello world");
    const tokens = measure(node, container, noHyphenation);
    expect(tokens).toHaveLength(3); // "hello", " ", "world"
  });

  it("classifies tokens correctly", () => {
    const node = createTextNode("Hi, world!");
    const tokens = measure(node, container, noHyphenation);
    const kinds = tokens.map((t) => t.kind);
    expect(kinds).toEqual([
      TokenKind.Word, // "Hi"
      TokenKind.Punctuation, // ","
      TokenKind.Whitespace, // " "
      TokenKind.Word, // "world"
      TokenKind.Punctuation, // "!"
    ]);
  });

  it("all non-empty tokens have positive widths", () => {
    const node = createTextNode("The quick, brown fox.");
    const tokens = measure(node, container, noHyphenation);
    for (const t of tokens) {
      expect(t.width).toBeGreaterThan(0);
    }
  });

  it("whitespace tokens have positive width", () => {
    const node = createTextNode("a b");
    const tokens = measure(node, container, noHyphenation);
    const space = tokens.find((t) => t.kind === TokenKind.Whitespace)!;
    expect(space.width).toBeGreaterThan(0);
  });
});

// Empty / edge cases -----------------------------------------------------------------------------
describe("edge cases", () => {
  it("empty text returns empty array", () => {
    const node = createTextNode("");
    expect(measure(node, container, noHyphenation)).toEqual([]);
  });

  it("single character", () => {
    const node = createTextNode("x");
    const tokens = measure(node, container, noHyphenation);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].width).toBeGreaterThan(0);
  });
});

// Width cache ------------------------------------------------------------------------------------
// Repeated tokens must get the exact same width from the cache.
describe("width cache", () => {
  it("identical tokens have identical widths", () => {
    const node = createTextNode("the cat and the dog and the fox");
    const tokens = measure(node, container, noHyphenation);
    const theTokens = tokens.filter((t) => t.text === "the");
    expect(theTokens.length).toBeGreaterThanOrEqual(3);
    const widths = new Set(theTokens.map((t) => t.width));
    expect(widths.size).toBe(1);
  });
});

// Monospace proportionality ----------------------------------------------------------------------
// With monospace, width is proportional to character count.
describe("monospace proportionality", () => {
  it("same-length words have equal width", () => {
    const node = createTextNode("cat dog");
    const tokens = measure(node, container, noHyphenation);
    const [cat, , dog] = tokens;
    expect(cat.width).toBe(dog.width);
  });

  it("longer words are wider", () => {
    const node = createTextNode("hi hello");
    const tokens = measure(node, container, noHyphenation);
    const [hi, , hello] = tokens;
    expect(hello.width).toBeGreaterThan(hi.width);
  });

  it("width scales linearly with character count", () => {
    const node = createTextNode("a aa aaa");
    const tokens = measure(node, container, noHyphenation);
    const a = tokens[0].width;
    const aa = tokens[2].width;
    const aaa = tokens[4].width;
    expect(aa).toBeCloseTo(a * 2, 1);
    expect(aaa).toBeCloseTo(a * 3, 1);
  });
});

// Hyphenation break options ----------------------------------------------------------------------
describe("hyphenation break options", () => {
  // Controlled stub: "information" breaks at positions [2, 5, 7].
  const stubHyphenate = (word: string): number[] => {
    if (word === "information") return [2, 5, 7];
    return [];
  };

  it("non-hyphenatable words have no breakOptions", () => {
    const node = createTextNode("cat");
    const tokens = measure(node, container, stubHyphenate);
    expect(tokens[0].breakOptions).toBeUndefined();
  });

  it("whitespace and punctuation never have breakOptions", () => {
    const node = createTextNode("hi, world");
    const tokens = measure(node, container, stubHyphenate);
    for (const t of tokens) {
      if (t.kind !== TokenKind.Word) {
        expect(t.breakOptions).toBeUndefined();
      }
    }
  });

  it("hyphenatable word has correct number of break options", () => {
    const node = createTextNode("information");
    const tokens = measure(node, container, stubHyphenate);
    expect(tokens[0].breakOptions).toHaveLength(3);
  });

  it("break option positions match hyphenate output", () => {
    const node = createTextNode("information");
    const tokens = measure(node, container, stubHyphenate);
    const positions = tokens[0].breakOptions!.map((o) => o.position);
    expect(positions).toEqual([2, 5, 7]);
  });

  it("preBreakWidth and postBreakWidth are positive", () => {
    const node = createTextNode("information");
    const tokens = measure(node, container, stubHyphenate);
    for (const option of tokens[0].breakOptions!) {
      expect(option.preBreakWidth).toBeGreaterThan(0);
      expect(option.postBreakWidth).toBeGreaterThan(0);
    }
  });

  it("preBreakWidth includes the hyphen glyph", () => {
    const node = createTextNode("information");
    const tokens = measure(node, container, stubHyphenate);
    // Break at position 2: pre = "in-" (3 chars), post = "formation" (9 chars)
    const first = tokens[0].breakOptions![0];
    const charWidth = tokens[0].width / "information".length;
    // "in-" is 3 monospace chars
    expect(first.preBreakWidth).toBeCloseTo(charWidth * 3, 0);
  });
});

// Deduplication across tokens --------------------------------------------------------------------
// Two occurrences of the same hyphenatable word must get independent break options.
describe("break option independence", () => {
  const stubHyphenate = (word: string): number[] => {
    if (word === "test") return [2]; // "te-" | "st"
    return [];
  };

  it("duplicate words each get their own breakOptions array", () => {
    const node = createTextNode("test and test");
    const tokens = measure(node, container, stubHyphenate);
    const testTokens = tokens.filter((t) => t.text === "test");
    expect(testTokens).toHaveLength(2);

    // Both have break options
    expect(testTokens[0].breakOptions).toHaveLength(1);
    expect(testTokens[1].breakOptions).toHaveLength(1);

    // But they are distinct arrays (independent copies)
    expect(testTokens[0].breakOptions).not.toBe(testTokens[1].breakOptions);
    expect(testTokens[0].breakOptions![0]).not.toBe(testTokens[1].breakOptions![0]);
  });
});

// Container cleanup ------------------------------------------------------------------------------
// The measurement container must be empty after measure() returns.
describe("container cleanup", () => {
  it("container has no children after measurement", () => {
    const node = createTextNode("information");
    const stubHyphenate = (word: string): number[] => {
      if (word === "information") return [2, 5, 7];
      return [];
    };
    measure(node, container, stubHyphenate);
    expect(container.childNodes.length).toBe(0);
  });
});
