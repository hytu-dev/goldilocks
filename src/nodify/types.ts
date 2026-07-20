export type TeXNode = Box | Glue | Penalty;

interface Box {
  type: "box";
  text: string;
  width?: number;
}

interface Glue {
  type: "glue";
  text: string;
  width?: number;
  stretch?: number;
}

interface Penalty {
  type: "penalty";
  text: string;
  width?: number;
  flag: boolean;
}
