import type { ReadonlyMarks, ReadonlyNodes } from "./nodes/init.ts";
import * as Nodes from "./nodes/init.ts";
import * as Space from "./space/init.ts";

const TAG = "goldi-break";
const SUPPORTED = new Set(["en"]);
const sheet = new CSSStyleSheet();
sheet.replaceSync(
  `${TAG}{display:block;text-align:justify;text-wrap:wrap;hyphens:manual}${Space.RULE}`,
);

export class GoldiBreak extends HTMLElement {
  static stash = new Map<string, number>();
  input = this.textContent;
  nodes: ReadonlyNodes | null = null;
  marks: ReadonlyMarks | null = null;
  #markup = this.childElementCount > 0;

  connectedCallback(): void {
    const doc = this.ownerDocument;
    if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets.push(sheet);
    Promise.all([Space.load(doc), doc.fonts.ready]).then(([loaded]) => {
      if (!loaded) console.warn(`<${TAG}> could not load its space font`);
      this.typeset();
    });
    this.addEventListener("copy", this.#onCopy);
  }

  disconnectedCallback(): void {
    this.removeEventListener("copy", this.#onCopy);
  }

  typeset(): void {
    const lang = this.getAttribute("lang");
    if (lang === null) throw new Error("<goldi-break> requires a lang attribute");
    if (!SUPPORTED.has(lang)) throw new Error(`<goldi-break> does not support lang="${lang}"`);
    if (this.#markup) throw new Error(`<goldi-break> does not support inline markup`);

    const lw = lineWidth(this);
    const fs = fontSize(this);
    Space.fit(this);

    this.nodes = Nodes.from(this.input);
    Nodes.size(GoldiBreak.stash, this, this.nodes);
    this.marks = Nodes.wrap(GoldiBreak.stash, this.nodes, { lineWidth: lw, emergency: 3 * fs });
    if (this.marks) {
      const text = Nodes.mark(this.nodes, this.marks).join("");
      this.replaceChildren(Space.render(this.ownerDocument, text));
    }
  }

  #onCopy = (e: ClipboardEvent): void => {
    const selected = this.ownerDocument.getSelection()?.toString();
    if (!selected || !e.clipboardData) return;
    e.preventDefault();
    const purified = selected.replaceAll("\u00A0", " ").replace(/[\u00AD\u2060]/g, "");
    e.clipboardData.setData("text/plain", purified);
  };
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
