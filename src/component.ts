// <goldi-break> takes no attributes: it reads the document's own language declaration, and typesets
// only when that language is one the pipeline supports. Everything else is left to native wrapping,
// which is always the correct fallback.

import { NBSP, type TeXNode } from "./defs.ts";
import { measure } from "./measure/index.ts";
import { nodify } from "./nodify/index.ts";
import { render } from "./render/index.ts";
import { type Break, solve } from "./solve/index.ts";

const TAG = "goldi-break";
const SHEET = "goldi-break-style";
const SUPPORTED = new Set(["en"]);

const PRETOLERANCE = 100; // \pretolerance
const TOLERANCE = 200; // \tolerance
const EMERGENCY_EM = 3; // \emergencystretch, in em, matching LaTeX's usual fussy-paragraph escape

// display:block gives the element a line width to solve for; the rest is the layout the solver
// assumed. It ships in <head> at zero specificity so that author styles always win.
const STYLE = `${TAG}{display:block;text-align:justify;text-wrap:wrap;hyphens:manual}`;

export class GoldiBreak extends HTMLElement {
  #source: string | null = null;

  connectedCallback(): void {
    install(this.ownerDocument);
    void this.#typeset();
  }

  async #typeset(): Promise<void> {
    const doc = this.ownerDocument;
    // Upgrading mid-parse means the children are not here yet, and webfont metrics are not final
    // until the font lands. Both would silently produce a layout for the wrong text.
    if (doc.readyState === "loading")
      await new Promise((done) => doc.addEventListener("DOMContentLoaded", done, { once: true }));
    await doc.fonts.ready;
    if (!this.isConnected) return;

    this.#source ??= this.textContent ?? "";
    if (!SUPPORTED.has(languageOf(this))) return;
    if (this.childElementCount > 0) return; // inline markup is not modelled yet

    // Glue renders as NBSP, so the text node has to spell it that way for measure()'s offsets to
    // line up with the nodes, and for the annotated output to have the widths that were solved.
    const text = this.#source.trim().replace(/\s+/gu, NBSP);
    const width = contentWidth(this);
    if (!text || width <= 0) return;

    this.textContent = text;
    const laid = layout(this, this.firstChild as Text, text, width);
    if (laid) this.textContent = render(laid.nodes, laid.breaks);
  }
}

if (!globalThis.customElements?.get(TAG)) globalThis.customElements?.define(TAG, GoldiBreak);

// helpers -----------------------------------------------------------------------------------------

/** TeX's escalation: no hyphens, then hyphens, then emergency stretch. */
function layout(
  el: HTMLElement,
  textNode: Text,
  text: string,
  width: number,
): { nodes: TeXNode[]; breaks: Break[] } | null {
  // A range that wraps reports the box, not the text, so nothing may wrap while measuring.
  const wrapping = el.style.whiteSpace;
  el.style.whiteSpace = "nowrap";
  try {
    const plain = nodify(text, false);
    const first = solve(plain, measure(plain, textNode, el), width, { tolerance: PRETOLERANCE });
    if (first) return { nodes: plain, breaks: first };

    const broken = nodify(text, true);
    const cache = measure(broken, textNode, el);
    const second = solve(broken, cache, width, { tolerance: TOLERANCE });
    if (second) return { nodes: broken, breaks: second };

    const emergencyStretch = EMERGENCY_EM * fontSize(el);
    const third = solve(broken, cache, width, { tolerance: TOLERANCE, emergencyStretch });
    return third ? { nodes: broken, breaks: third } : null;
  } finally {
    el.style.whiteSpace = wrapping;
  }
}

/** The nearest declared language, falling back to the document's own meta declaration. */
function languageOf(el: HTMLElement): string {
  const declared = el.closest("[lang]")?.getAttribute("lang");
  const meta = el.ownerDocument.querySelector('meta[http-equiv="content-language" i]');
  const tag = declared || meta?.getAttribute("content") || "";
  return tag.trim().toLowerCase().split(/[-,]/u)[0];
}

function contentWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  return el.clientWidth - padding;
}

function fontSize(el: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(el).fontSize) || 16;
}

function install(doc: Document): void {
  if (doc.getElementById(SHEET)) return;
  const style = doc.createElement("style");
  style.id = SHEET;
  style.textContent = STYLE;
  doc.head.prepend(style);
}
