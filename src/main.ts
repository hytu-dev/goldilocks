import * as Nodes from "./nodes/init.ts";
import * as Space from "./space/init.ts";

const TAG = "goldi-break";
const SUPPORTED = new Set(["en"]);
const sheet = new CSSStyleSheet();
sheet.replaceSync(
  `${TAG}{display:block;text-align:justify;text-wrap:wrap;hyphens:manual}${Space.RULE}`,
);

export class GoldiBreak extends HTMLElement {
  static #stash = new Map<string, number>();
  #input = this.textContent;
  #markup = this.childElementCount > 0;

  connectedCallback(): void {
    const doc = this.ownerDocument;
    if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets.push(sheet);
    Promise.all([Space.load(doc), doc.fonts.ready]).then(([loaded]) => {
      if (!loaded) console.warn(`<${TAG}> could not load its space font`);
      this.#typeset();
    });
  }

  #typeset(): void {
    const lang = this.getAttribute("lang");
    if (lang === null) throw new Error("<goldi-break> requires a lang attribute");
    if (!SUPPORTED.has(lang)) throw new Error(`<goldi-break> does not support lang="${lang}"`);
    if (this.#markup) throw new Error(`<goldi-break> does not support inline markup`);

    const lw = lineWidth(this);
    const fs = fontSize(this);
    Space.fit(this);

    const nodes = Nodes.from(this.#input);
    Nodes.size(GoldiBreak.#stash, this, nodes);
    const marks = Nodes.wrap(GoldiBreak.#stash, nodes, { lineWidth: lw, emergency: 3 * fs });
    if (marks) {
      const text = Nodes.mark(nodes, marks).join("");
      this.replaceChildren(Space.render(this.ownerDocument, text));
    }
  }
}

if (!globalThis.customElements.get(TAG)) globalThis.customElements.define(TAG, GoldiBreak);

// helpers -----------------------------------------------------------------------------------------

function lineWidth(element: HTMLElement): number {
  const { paddingLeft, paddingRight } = getComputedStyle(element);
  return element.clientWidth - (parseFloat(paddingLeft) + parseFloat(paddingRight));
}

function fontSize(element: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(element).fontSize);
}
