export type Node = Glue | Item;

export type Glue = { type: "glue"; text: string; ratio: number };

export function glue(): Glue {
  return { type: "glue", text: NON_BREAKING_SPACE, ratio: 0.5 };
}

export type Item = { type: "item"; text: string; discs: Disc[] };

export function item(text: string, discs: Disc[]): Item {
  return { type: "item", text, discs };
}

export type Disc = { offset: number; suffix: string; prefix: string; intact: string };

export function disc(offset: number, suffix = HYPHEN_MINUS, prefix = "", intact = ""): Disc {
  return { offset, suffix, prefix, intact };
}

export const NON_BREAKING_SPACE = "\u00A0";
export const HYPHEN_MINUS = "\u002D";

export type Clip = { prefix: string; body: string; suffix: string };

export function clip({ text, discs: d }: Item, i: number, j: number): Clip {
  const [lhs, prefix] = i < 0 ? [0, ""] : [d[i].offset + d[i].intact.length, d[i].prefix];
  const [rhs, suffix] = j < d.length ? [d[j].offset, d[j].suffix] : [text.length, ""];
  return { prefix, body: text.slice(lhs, rhs), suffix };
}

export function fuse(item: Item, i: number, j: number): string {
  const { prefix, body, suffix } = clip(item, i, j);
  return prefix + body + suffix;
}

export type Mark = { nidx: number; didx?: number };

export type Stash = Map<string, number>;
export type ReadonlyStash = ReadonlyMap<string, number>;
export type ReadonlyNodes = ReadonlyArray<Node>;
export type ReadonlyMarks = ReadonlyArray<Mark>;
