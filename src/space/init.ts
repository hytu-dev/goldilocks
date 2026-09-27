import { DATA, FAMILY } from "./data.ts";

// every space is drawn by the Goldilocks space font inside its own element, so that no shaping
// (kerning, ligatures) reaches across it; line-height: 0 flattens the element to a zero-height box
// that leaves the line box alone, and its width comes from word-spacing alone, since the glyph has
// zero advance
export const TAG = "goldi-space";

// the natural width of a space, relative to that of the surrounding font
export const RATIO = 2 / 3;

const FONT = "--goldi-space-font";
const WIDTH = "--goldi-space-width";

export const RULE =
  `${TAG}{font-family:var(${FONT});word-spacing:var(${WIDTH});` +
  "line-height:0;font-synthesis:none;font-size-adjust:none}";

const faces = new WeakMap<Document, Promise<boolean>>();

export function load(doc: Document): Promise<boolean> {
  let loaded = faces.get(doc);
  if (!loaded) {
    const face = new FontFace(FAMILY, bytes(), {
      unicodeRange: "U+20, U+A0",
      weight: "1 1000",
      stretch: "50% 200%",
    });
    doc.fonts.add(face);
    loaded = face.load().then(
      () => true,
      () => false,
    );
    faces.set(doc, loaded);
  }
  return loaded;
}

// sets the space width on the element to RATIO times the width of a space in its own font, the
// latter including any word-spacing and letter-spacing the element carries
export function fit(element: HTMLElement): void {
  const doc = element.ownerDocument;
  const { fontFamily, fontSize } = getComputedStyle(element);
  // the element's own fonts follow as a fallback, should the space font fail to load
  element.style.setProperty(FONT, `"${FAMILY}", ${fontFamily}`);
  element.style.setProperty(WIDTH, "0px");

  const probe = doc.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
  const plain = probe.appendChild(doc.createElement("span"));
  const space = probe.appendChild(doc.createElement(TAG));
  plain.textContent = space.textContent = " ";
  element.appendChild(probe);
  const target = RATIO * plain.getBoundingClientRect().width;
  const bare = space.getBoundingClientRect().width;
  probe.remove();

  element.style.setProperty(WIDTH, `${(target - bare) / Number.parseFloat(fontSize)}em`);
}

export function render(doc: Document, text: string): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const [i, part] of text.split(/([  ])/).entries()) {
    if (i % 2) fragment.appendChild(doc.createElement(TAG)).textContent = part;
    else if (part) fragment.append(part);
  }
  return fragment;
}

// helpers -----------------------------------------------------------------------------------------

function bytes(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(DATA), (c) => c.charCodeAt(0));
}
