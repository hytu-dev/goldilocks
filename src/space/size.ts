import { RATIO, WIDTH } from "./defs.ts";

// sets the space width on the element to RATIO times the width of a space in its own font
export function size(element: HTMLElement): void {
  const probe = element.appendChild(document.createElement("span"));
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
  probe.textContent = " ";
  const width = RATIO * probe.getBoundingClientRect().width;
  probe.remove();
  const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
  element.style.setProperty(WIDTH, `${width / fontSize}em`);
}
