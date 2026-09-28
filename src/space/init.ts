import { DATA, FAMILY } from "./data.ts";

// every space is drawn by the Goldilocks space font inside its own element, so that no shaping
// (kerning, ligatures) reaches across it; line-height: 0 flattens the element to a zero-height box
// that leaves the line box alone, and its width comes from word-spacing alone, since the glyph has
// zero advance
export const TAG = "goldi-space";

// the natural width of a space, relative to that of the surrounding font
export const RATIO = 2 / 3;

const WIDTH = "--goldi-space-width";

export const RULE = `${TAG}{font-family:"${FAMILY}";word-spacing:var(${WIDTH});line-height:0;font-synthesis:none}`;

let loaded: Promise<FontFace> | undefined;

export function load(): Promise<FontFace> {
  if (!loaded) {
    const face = new FontFace(FAMILY, bytes(), { unicodeRange: "U+20, U+A0" });
    document.fonts.add(face);
    loaded = face.load();
  }
  return loaded;
}

// sets the space width on the element to RATIO times the width of a space in its own font
export function fit(element: HTMLElement): void {
  const probe = element.appendChild(document.createElement("span"));
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
  probe.textContent = " ";
  const width = RATIO * probe.getBoundingClientRect().width;
  probe.remove();
  const size = Number.parseFloat(getComputedStyle(element).fontSize);
  element.style.setProperty(WIDTH, `${width / size}em`);
}

export function render(doc: Document, text: string): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const [i, part] of text.split(/([\u0020\u00A0])/).entries()) {
    if (i % 2) fragment.appendChild(doc.createElement(TAG)).textContent = part;
    else if (part) fragment.append(part);
  }
  return fragment;
}

// helpers -----------------------------------------------------------------------------------------

function bytes(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(DATA), (c) => c.charCodeAt(0));
}
