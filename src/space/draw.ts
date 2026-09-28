import { TAG } from "./defs.ts";

export function draw(doc: Document, text: string): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const [i, part] of text.split(/([\u0020\u00A0])/).entries()) {
    if (i % 2) fragment.appendChild(doc.createElement(TAG)).textContent = part;
    else if (part) fragment.append(part);
  }
  return fragment;
}
