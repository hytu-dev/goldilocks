import * as Utils from "./../utils/init.ts";
import { type Disc, disc, glue, item, type Node, type ReadonlyNodes } from "./defs.ts";

const RULE = /(?<glue>\s+)|(?<hyph>-+)|(?<alph>\p{L}+)|(?<misc>[^\s\p{L}-]+)/gu;

type Kind = "glue" | "hyph" | "alph" | "misc";
type Span = { kind: Kind; text: string };

export function from(input: string): ReadonlyNodes {
  const spans = scan(input);
  const nodes: Node[] = [];

  for (const [i, { kind, text }] of spans.entries()) {
    const prev = spans[i - 1]?.kind;
    const next = spans[i + 1]?.kind ?? "glue"; // input is trimmed, so the end is a boundary

    switch (kind) {
      case "glue":
        nodes.push(glue());
        break;
      case "alph": {
        const compound = prev === "hyph" || next === "hyph";
        emit(nodes, text, compound ? [] : Utils.hyph(text).map((p) => disc(p)));
        break;
      }
      case "hyph": {
        const breakable = next !== "glue" && (text.length === 1 || prev === "alph");
        emit(nodes, text, breakable ? [disc(text.length, "")] : []);
        break;
      }
      case "misc":
        emit(nodes, text, []);
        break;
    }
  }

  return nodes;
}

// helpers -----------------------------------------------------------------------------------------

function emit(nodes: Node[], text: string, discs: Disc[]): void {
  const last = nodes.at(-1);
  if (last?.type === "item") {
    const shifted = discs.map((d) => ({ ...d, offset: d.offset + last.text.length }));
    last.text += text;
    last.discs.push(...shifted);
  } else {
    nodes.push(item(text, discs));
  }
}

function scan(text: string): Span[] {
  return Array.from(text.trim().matchAll(RULE), (m) => {
    for (const k in m.groups) {
      if (m.groups[k]) return { kind: k as Kind, text: m[0] };
    }
    throw new Error("from: unreachable");
  });
}
