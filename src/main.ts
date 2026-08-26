import * as Nodes from "./nodes/init.ts";

const TAG = "goldi-break";
const SUPPORTED = new Set(["en"]);
const sheet = new CSSStyleSheet();
sheet.replaceSync(`${TAG}{display:block;text-align:justify;text-wrap:wrap;hyphens:manual}`);

export class GoldiBreak extends HTMLElement {
  static #stash = new Map<string, number>();
  #input = this.textContent;

  connectedCallback(): void {
    const sheets = this.ownerDocument.adoptedStyleSheets;
    if (!sheets.includes(sheet)) sheets.push(sheet);
    this.ownerDocument.fonts.ready.then(() => this.#typeset());
  }

  #typeset(): void {
    const lang = this.getAttribute("lang");
    if (lang === null) throw new Error("<goldi-break> requires a lang attribute");
    if (!SUPPORTED.has(lang)) throw new Error(`<goldi-break> does not support lang="${lang}"`);
    if (this.childElementCount > 0) throw new Error(`<goldi-break> does not support inline markup`);

    const lw = lineWidth(this);
    const fs = fontSize(this);

    const nodes = Nodes.from(this.#input);
    Nodes.size(GoldiBreak.#stash, this, nodes);
    const marks = Nodes.wrap(GoldiBreak.#stash, nodes, { lineWidth: lw, emergency: 3 * fs });
    if (marks) this.textContent = Nodes.mark(nodes, marks).join("");
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
