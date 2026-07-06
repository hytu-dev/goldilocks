import { describe, it, expect } from "vitest";
import { solve } from "./solver";
import { TokenKind, type MeasuredToken } from "../measurement";

const w = (
  width: number,
  breakOptions?: { preBreakWidth: number; postBreakWidth: number }[],
) => ({ kind: TokenKind.Word, width, breakOptions }) as MeasuredToken;

const s = (width: number) =>
  ({ kind: TokenKind.Whitespace, width }) as MeasuredToken;

describe("solver sanity", () => {
  it("returns zero lines for empty input", () => {
    expect(solve([], 100)).toEqual({ lines: [] });
  });

  describe("single line, exact fit", () => {
    const r = solve([w(50), s(10), w(50)], 200)!;

    it("produces one line", () => {
      expect(r.lines).toHaveLength(1);
    });

    it("spans tokens 0–2", () => {
      expect(r.lines[0]).toMatchObject({ startToken: 0, endToken: 2 });
    });

    it("has ratio 0 (ragged last line)", () => {
      expect(r.lines[0].ratio).toBe(0);
    });
  });

  describe("forced two-line break at a gap", () => {
    const r = solve([w(50), s(10), w(50), s(10), w(50)], 115)!;

    it("produces two lines", () => {
      expect(r.lines).toHaveLength(2);
    });

    it("line 1 spans tokens 0–2", () => {
      expect(r.lines[0]).toMatchObject({ startToken: 0, endToken: 2 });
    });

    it("line 2 spans tokens 4–4", () => {
      expect(r.lines[1]).toMatchObject({ startToken: 4, endToken: 4 });
    });

    it("line 1 has ratio 1 (loose)", () => {
      expect(r.lines[0].ratio).toBeCloseTo(1, 9);
    });
  });

  describe("hyphenation break with fragments", () => {
    const tokens = [
      w(40),
      s(10),
      w(100, [{ preBreakWidth: 55, postBreakWidth: 50 }]),
    ];
    const r = solve(tokens, 105)!;

    it("produces two lines", () => {
      expect(r.lines).toHaveLength(2);
    });

    it("line 1 has endBreak at token 2", () => {
      expect(r.lines[0].endBreak?.tokenIndex).toBe(2);
    });

    it("line 2 has startBreak at token 2", () => {
      expect(r.lines[1].startBreak?.tokenIndex).toBe(2);
    });

    it("line 1 ratio is 0 (exact fit)", () => {
      expect(r.lines[0].ratio).toBe(0);
    });

    it("line 2 spans tokens 2–2", () => {
      expect(r.lines[1]).toMatchObject({ startToken: 2, endToken: 2 });
    });
  });

  describe("trailing whitespace", () => {
    const r = solve([w(50), s(10), w(50), s(10)], 60)!;

    it("does not create an inverted line", () => {
      const hasInverted = r.lines.some((l) => l.startToken > l.endToken);
      expect(hasInverted).toBe(false);
    });

    it("produces two lines", () => {
      expect(r.lines).toHaveLength(2);
    });

    it("last line ends at content token", () => {
      expect(r.lines[1].endToken).toBe(2);
    });
  });

  describe("leading whitespace", () => {
    const r = solve([s(10), w(50)], 55)!;

    it("produces one line", () => {
      expect(r.lines).toHaveLength(1);
    });

    it("spans tokens 1–1 (whitespace trimmed)", () => {
      expect(r.lines[0]).toMatchObject({ startToken: 1, endToken: 1 });
    });

    it("has ratio 0", () => {
      expect(r.lines[0].ratio).toBe(0);
    });
  });

  describe("consecutive whitespace run mid-paragraph", () => {
    const r = solve([w(50), s(5), s(5), w(50)], 55)!;

    it("produces two lines", () => {
      expect(r.lines).toHaveLength(2);
    });

    it("spans 0–0 / 3–3", () => {
      expect(r.lines[0]).toMatchObject({ startToken: 0, endToken: 0 });
      expect(r.lines[1]).toMatchObject({ startToken: 3, endToken: 3 });
    });
  });

  it("returns null for a word wider than lineWidth with no break options", () => {
    expect(solve([w(300)], 100)).toBeNull();
  });

  it("returns zero lines for all-whitespace input", () => {
    const r = solve([s(10), s(10)], 100)!;
    expect(r.lines).toHaveLength(0);
  });

  describe("global optimization: KP vs greedy", () => {
    const tokens = [w(45), s(10), w(45), s(10), w(45), s(10), w(45)];
    const r = solve(tokens, 120)!;

    it("produces two lines", () => {
      expect(r.lines).toHaveLength(2);
    });

    it("balances the split at 0–2 / 4–6", () => {
      expect(r.lines[0].endToken).toBe(2);
      expect(r.lines[1].startToken).toBe(4);
    });
  });

  it("ratio monotonicity: zero-stretch glue does not invert scoring", () => {
    const tokens = [w(30), s(0.001), w(30), s(10), w(30)];
    const r = solve(tokens, 200)!;
    expect(r.lines).toHaveLength(1);
  });
});
