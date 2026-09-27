import { expect, type Page, test } from "@playwright/test";

type Box = { text: boolean; top: number; bottom: number; left: number; right: number };
type Geometry = { height: number; baseline: number; boxes: Box[] };
type Lab = {
  TEXT: string;
  make(options?: { text?: string; style?: string }): Promise<HTMLElement>;
  width(text: string, style: string): number;
  control(element: HTMLElement): HTMLElement;
  geometry(root: HTMLElement): Geometry;
  ink(png: string): Promise<number[]>;
};
declare global {
  interface Window {
    lab: Lab;
  }
}

const KERN = 'font:100px "Goldi Kern Test"';
const PLAIN = 'font:18px "Goldi Plain Test"';

async function open(page: Page): Promise<void> {
  await page.goto("/test/space.html");
  await page.waitForSelector("html[data-ready]", { state: "attached" });
}

test.beforeEach(async ({ page }) => open(page));

test("spaces are drawn by the space font, at 2/3 of the downstream space", async ({ page }) => {
  const r = await page.evaluate(async (PLAIN) => {
    const { make, width } = window.lab;
    const element = await make({ text: "a b", style: `${PLAIN};width:400px` });
    const probe = element.appendChild(document.createElement("goldi-space"));
    probe.style.whiteSpace = "pre";
    const measure = (text: string, wordSpacing = "") => {
      probe.textContent = text;
      probe.style.wordSpacing = wordSpacing;
      return probe.getBoundingClientRect().width;
    };
    const result = {
      downstream: width(" ", PLAIN),
      space: measure(" "),
      nbsp: measure(" "),
      bareSpace: measure(" ", "0px"),
      bareNbsp: measure(" ", "0px"),
    };
    probe.remove();
    return result;
  }, PLAIN);
  test.info().annotations.push({ type: "widths", description: JSON.stringify(r) });
  // with no word-spacing, a space has the zero advance of the space font's glyph
  expect(r.bareSpace).toBeCloseTo(0, 2);
  expect(r.bareNbsp).toBeCloseTo(0, 2);
  expect(r.space).toBeCloseTo((2 / 3) * r.downstream, 1);
  expect(r.nbsp).toBeCloseTo((2 / 3) * r.downstream, 1);
});

for (const [name, text] of [
  ["kerning", "T A"],
  ["ligature", "x x"],
] as const) {
  test(`${name} does not reach across a space`, async ({ page }) => {
    const r = await page.evaluate(
      async ({ KERN, text }) => {
        const { make, width } = window.lab;
        const element = await make({ text, style: `${KERN};width:2000px` });
        const range = document.createRange();
        range.selectNodeContents(element);
        const parts = [...element.childNodes].map((n) =>
          n.nodeName === "GOLDI-SPACE"
            ? (n as Element).getBoundingClientRect().width
            : width(n.textContent ?? "", KERN),
        );
        return {
          // the fixture itself: shaped as one run, the text is kerned or ligated
          plain: width(text, KERN),
          unshaped: [...text].reduce((sum, c) => sum + width(c, KERN), 0),
          ligature: width("Z", KERN),
          // the typeset text (word joiners included) put back into one run in the same font
          rejoined: width(element.textContent ?? "", KERN),
          // the typeset text in place, against the sum of its pieces shaped one by one
          typeset: range.getBoundingClientRect().width,
          pieces: parts.reduce((a, b) => a + b, 0),
        };
      },
      { KERN, text },
    );
    test.info().annotations.push({ type: "widths", description: JSON.stringify(r) });
    expect(r.plain, "the fixture font shapes across the space").toBeLessThan(r.unshaped - 20);
    if (name === "ligature") expect(r.plain).toBeCloseTo(r.ligature, 0);
    expect(r.typeset, "no shaping across the space").toBeCloseTo(r.pieces, 1);
  });
}

const CASES: Record<string, string> = {
  "line-height: normal": "",
  "line-height: 1": "line-height:1",
  "line-height: 1.5": "line-height:1.5",
  "line-height: 2": "line-height:2",
  "line-height: 0.8": "line-height:0.8",
  bold: "font-weight:bold",
  italic: "font-style:italic",
  "font-size-adjust": "font-size-adjust:0.6",
  underline: "text-decoration:underline",
  "letter- and word-spacing": "letter-spacing:0.05em;word-spacing:0.1em",
};

for (const [name, style] of Object.entries(CASES)) {
  test(`layout matches the downstream font (${name})`, async ({ page }) => {
    const { typeset, control, spaces } = await page.evaluate(async (style) => {
      const { make, control, geometry } = window.lab;
      const element = await make({ style });
      const div = control(element);
      const spaces = element.querySelectorAll("goldi-space").length;
      element.id = "typeset";
      div.id = "control";
      return { typeset: geometry(element), control: geometry(div), spaces };
    }, `${PLAIN};width:320px;${style}`);
    const lines = new Set(typeset.boxes.filter((b) => b.text).map((b) => b.top)).size;
    test.info().annotations.push({
      type: "geometry",
      description: `lines=${lines} spaces=${spaces} height=${typeset.height} baseline=${typeset.baseline}`,
    });
    expect(lines).toBeGreaterThan(2);
    expect(typeset.height).toBeCloseTo(control.height, 2);
    expect(typeset.baseline).toBeCloseTo(control.baseline, 2);
    expect(typeset.boxes.length).toBe(control.boxes.length);
    for (const [i, box] of typeset.boxes.entries()) {
      const twin = control.boxes[i];
      // the control only approximates the space width, to layout rounding
      expect(Math.abs(box.left - twin.left), `box ${i} left`).toBeLessThan(0.25);
      expect(Math.abs(box.right - twin.right), `box ${i} right`).toBeLessThan(0.25);
      if (!box.text) continue; // a <goldi-space> is a zero-height box by design
      expect(box.top, `box ${i} top`).toBeCloseTo(twin.top, 2);
      expect(box.bottom, `box ${i} bottom`).toBeCloseTo(twin.bottom, 2);
    }
    const [a, b] = [
      await page.locator("#typeset").screenshot(),
      await page.locator("#control").screenshot(),
    ];
    await test.info().attach("typeset", { body: a, contentType: "image/png" });
    await test.info().attach("control", { body: b, contentType: "image/png" });
    if (process.env.SHOTS) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(`${process.env.SHOTS}/${test.info().project.name}-${name}-typeset.png`, a);
      writeFileSync(`${process.env.SHOTS}/${test.info().project.name}-${name}-control.png`, b);
    }
    // antialiasing differs with sub-pixel positions, but rules (underlines) must match row by row
    const [ra, rb] = await page.evaluate(
      async ([a, b]) => [await window.lab.ink(a), await window.lab.ink(b)],
      [a.toString("base64"), b.toString("base64")],
    );
    expect(ra.length).toBe(rb.length);
    for (const [y, dark] of rb.entries()) {
      if (dark > 0.5) expect(ra[y], `rule on row ${y}`).toBeCloseTo(dark, 1);
    }
  });
}
