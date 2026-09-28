import { fuse } from "../nodes/defs.ts";
import type { ReadonlyMarks, ReadonlyNodes } from "../nodes/init.ts";

export function dump(nodes: ReadonlyNodes, marks: ReadonlyMarks): void {
  console.table(
    marks.map((m) => {
      const node = nodes[m.nidx];
      if (node.type === "glue") {
        const prev = nodes[m.nidx - 1] as any;
        const next = nodes[m.nidx + 1] as any;
        return { ...m, type: "glue", between: `${prev.text} | ${next.text}` };
      } else {
        const didx = m.didx!;
        return {
          ...m,
          type: "item",
          break: `${fuse(node, didx - 1, didx)}|${fuse(node, didx, didx + 1)}`,
        };
      }
    }),
  );
}
