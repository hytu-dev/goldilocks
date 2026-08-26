import { clip, NON_BREAKING_SPACE, type ReadonlyMarks, type ReadonlyNodes } from "./defs.ts";

const SPACE = "\u0020";
const WORD_JOINER = "\u2060";
const SOFT_HYPHEN = "\u00AD";

export function mark(nodes: ReadonlyNodes, marks: ReadonlyMarks): readonly string[] {
  const lines: string[] = [];
  let line = "";
  let midx = 0;

  for (const [nidx, node] of nodes.entries()) {
    switch (node.type) {
      case "glue":
        if (marks[midx]?.nidx !== nidx) {
          line += NON_BREAKING_SPACE;
          break;
        }
        lines.push(line + SPACE); // the space stays with the line it ends
        line = "";
        ++midx;
        break;
      case "item": {
        const didxs: number[] = [];
        while (marks[midx]?.nidx === nidx) {
          if (marks[midx].didx !== undefined) didxs.push(marks[midx].didx!);
          ++midx;
        }
        let prev = -1;
        for (const curr of didxs) {
          const { prefix, body, suffix } = clip(node, prev, curr);
          lines.push(line + open(prefix + body) + (suffix ? SOFT_HYPHEN : ""));
          line = "";
          prev = curr;
        }
        const { prefix, body } = clip(node, prev, node.discs.length);
        line += seal(prefix + body); // the tail closes the item
        break;
      }
    }
  }

  lines.push(line);
  return lines;
}

// helpers -----------------------------------------------------------------------------------------

function seal(text: string): string {
  return [...text, ""].join(WORD_JOINER);
}

function open(text: string): string {
  return [...text].join(WORD_JOINER);
}
