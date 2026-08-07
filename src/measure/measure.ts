import { NBSP, segment, type TeXNode } from "../defs.ts";

const STRETCH_RATIO = 0.5;
const Q = 1 / 60;

export function measure(nodes: TeXNode[], textNode: Text, el: HTMLElement): Map<string, number> {
  const [cache, wrapper] = batchMeasure(collectSegments(nodes), el);
  const range = textNode.ownerDocument.createRange();
  const nbsp = cache.get(NBSP) as number;
  let offset = 0;

  for (const node of nodes) {
    switch (node.type) {
      case "item":
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset + node.text.length);
        node.width = range.getBoundingClientRect().width + Q;
        break;
      case "glue":
        node.width = nbsp;
        node.stretch = STRETCH_RATIO * nbsp;
        break;
    }
    offset += node.text.length;
  }

  wrapper.remove();
  return cache;
}

// helpers -----------------------------------------------------------------------------------------

function batchMeasure(segments: Set<string>, el: HTMLElement): [Map<string, number>, HTMLElement] {
  const wrapper = el.ownerDocument.createElement("span");
  wrapper.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
  for (const seg of segments) {
    const span = el.ownerDocument.createElement("span");
    span.textContent = seg;
    wrapper.appendChild(span);
  }
  el.appendChild(wrapper);
  const cache = new Map<string, number>();
  for (const child of wrapper.children)
    cache.set(child.textContent ?? "", child.getBoundingClientRect().width + Q);
  return [cache, wrapper];
}

/**
 * Every fragment solve() can ask for, spelled by segment() itself so that the two cannot drift.
 * The whole item is absent on purpose: it is a node, and measure() prices it from the Range.
 */
function collectSegments(nodes: TeXNode[]): Set<string> {
  const segments = new Set<string>([NBSP]);
  for (const node of nodes) {
    if (node.type !== "item" || !node.discs) continue;
    const cuts = node.discs.map((_, i) => i);
    for (const from of [undefined, ...cuts])
      for (const to of [...cuts, undefined]) {
        if (from === undefined ? to === undefined : to !== undefined && to <= from) continue;
        segments.add(segment(node, from, to));
      }
  }
  return segments;
}
