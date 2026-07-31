export type TeXNode = Item | Glue;

export const NBSP = "\u00A0";
export const HYPH = "\u002D";

export interface Item {
  type: "item";
  text: string;
  width?: number;
  discs?: Disc[];
}

export function item(text: string, discs?: Disc[]): Item {
  return discs?.length ? { type: "item", text, discs } : { type: "item", text };
}

interface Disc {
  offset: number;
  pre: string;
  post: string;
  replace: string;
}

export function disc(offset: number, pre = "", post = "", replace = ""): Disc {
  return { offset, pre, post, replace };
}

export interface Glue {
  type: "glue";
  text: string;
  width?: number;
  stretch?: number;
}

export function glue(text: string = NBSP): Glue {
  return { type: "glue", text };
}
