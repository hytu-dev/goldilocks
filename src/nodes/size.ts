import { fuse, type ReadonlyNodes, type Stash } from "./defs.ts";

const EPSILON = 1 / 60; // Gecko app unit = 1/60px, Blink/WebKit LayoutUnit = 1/64px

export function size(cache: Stash, element: HTMLElement, nodes: ReadonlyNodes): void {
  const pending = new Set<string>();

  for (const n of nodes) {
    switch (n.type) {
      case "glue":
        pending.add(n.text);
        break;
      case "item":
        for (let i = -1; i < n.discs.length; ++i) {
          for (let j = i + 1; j <= n.discs.length; ++j) {
            pending.add(fuse(n, i, j));
          }
        }
        break;
    }
  }

  const wrapper = element.ownerDocument.createElement("span");
  wrapper.style.cssText = "position:absolute;visibility:hidden;text-wrap:nowrap";

  for (const p of pending) {
    if (cache.has(p)) continue;
    const snippet = wrapper.appendChild(element.ownerDocument.createElement("span"));
    snippet.textContent = p;
  }

  if (!wrapper.firstChild) return;
  element.appendChild(wrapper);

  for (const c of wrapper.children) {
    cache.set(c.textContent, c.getBoundingClientRect().width + EPSILON);
  }

  wrapper.remove();
}
