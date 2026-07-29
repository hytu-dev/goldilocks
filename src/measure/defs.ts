export type TeXNode = Item | Glue;

export const NBSP = "\u00A0";

interface Item {
  type: "item";
  text: string;
  width?: number;
  discs?: Disc[]; // Empty = No breakpoint
}

interface Disc {
  offset: number;
  pre: string;
  post: string;
  replace: string;
  penalty: number;
}

interface Glue {
  type: "glue";
  text: string;
  width?: number;
  stretch?: number;
}
