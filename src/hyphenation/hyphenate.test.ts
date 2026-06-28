import { describe, it, expect } from "vitest";
import { hyphenate } from "./hyphenate";

// Convert a breakpoints array into a readable hyphenated string.
// e.g. visualize("hyphenation", [2, 6]) → "hy·phen·ation"
function visualize(word: string, points: number[]): string {
  let result = "";
  let prev = 0;
  for (const p of points) {
    result += word.slice(prev, p) + "·";
    prev = p;
  }
  return result + word.slice(prev);
}

// Exception words --------------------------------------------------------------------------------
// Breakpoints from the TeX hyph-en-us exception list.
describe("exception words", () => {
  const cases: [string, number[]][] = [
    ["associate", [2, 4]],
    ["associates", [2, 4]],
    ["declination", [3, 5, 7]],
    ["obligatory", [5, 6]],
    ["philanthropic", [4, 6]],
    ["present", []],
    ["presents", []],
    ["project", []],
    ["projects", []],
    ["reciprocity", [4]],
    ["recognizance", [2, 5, 7]],
    ["reformation", [3, 5, 7]],
    ["retribution", [3, 5, 7]],
    ["table", [2]],
  ];

  for (const [word, expected] of cases) {
    it(`${word} → ${visualize(word, expected)}`, () => {
      expect(hyphenate(word)).toEqual(expected);
    });
  }
});

// Common words -----------------------------------------------------------------------------------
// Pattern matching verified against common English words.
describe("common words", () => {
  const cases: [string, number[]][] = [
    ["hyphenation", [2, 6]],
    ["concatenation", [3, 7, 9]],
    ["representation", [3, 5, 8, 10]],
    ["algorithm", [2, 4]],
    ["computer", [3]],
    ["typography", [2, 5, 7]],
    ["university", [3, 6]],
    ["beautiful", [4, 6]],
    ["programming", [3, 7]],
    ["information", [2, 5, 7]],
    ["international", [2, 5, 7]],
    ["extraordinary", [2, 5, 7, 9]],
    ["Mississippi", [3, 6]],
    ["encyclopedia", [2, 4, 7, 9]],
  ];

  for (const [word, expected] of cases) {
    it(`${word} → ${visualize(word.toLowerCase(), expected)}`, () => {
      expect(hyphenate(word)).toEqual(expected);
    });
  }
});

// Short / trivial words --------------------------------------------------------------------------
// Too short to break; LEFT_MIN=2 + RIGHT_MIN=3 needs ≥5 chars.
describe("short words return no breakpoints", () => {
  const words = ["", "a", "I", "ab", "be", "do", "go", "the", "cat", "dog", "run", "ox", "x"];

  for (const word of words) {
    it(`"${word}" → []`, () => {
      expect(hyphenate(word)).toEqual([]);
    });
  }
});

// Case insensitivity -----------------------------------------------------------------------------
// Casing is ignored; hyphenate() lowercases internally.
describe("case insensitivity", () => {
  it("uppercase input produces same breakpoints as lowercase", () => {
    expect(hyphenate("Hyphenation")).toEqual(hyphenate("hyphenation"));
  });

  it("all-caps word still works", () => {
    expect(hyphenate("HELLO")).toEqual(hyphenate("hello"));
  });

  it("mixed case", () => {
    expect(hyphenate("TyPoGrApHy")).toEqual(hyphenate("typography"));
  });
});

// Structural invariants --------------------------------------------------------------------------
// Output must satisfy these properties for any input.
describe("structural invariants", () => {
  const testWords = [
    "supercalifragilisticexpialidocious",
    "antidisestablishmentarianism",
    "representation",
    "table",
    "cat",
  ];

  for (const word of testWords) {
    describe(word, () => {
      const points = hyphenate(word);

      it("returns an array", () => {
        expect(Array.isArray(points)).toBe(true);
      });

      it("all breakpoints are integers", () => {
        for (const p of points) {
          expect(Number.isInteger(p)).toBe(true);
        }
      });

      it("breakpoints are strictly ascending", () => {
        for (let i = 1; i < points.length; i++) {
          expect(points[i]).toBeGreaterThan(points[i - 1]);
        }
      });

      it("respects LEFT_MIN=2 (no break before position 2)", () => {
        for (const p of points) {
          expect(p).toBeGreaterThanOrEqual(2);
        }
      });

      it("respects RIGHT_MIN=3 (last fragment ≥ 3 chars)", () => {
        for (const p of points) {
          expect(word.length - p).toBeGreaterThanOrEqual(3);
        }
      });
    });
  }
});
