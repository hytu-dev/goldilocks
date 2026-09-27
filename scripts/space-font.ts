// Builds the Goldilocks space font: a minimal TrueType font whose only glyph, shared by U+0020 and
// U+00A0, is empty with zero advance. The width of a space is left to CSS word-spacing, and the font
// exists only so that spaces fall in a shaping run of their own.
//
// The vertical metrics are ordinary ones (ascent + descent = 1em), not zero: Chromium paints no
// text decoration over a fragment whose font has zero ascent and descent. The inline box is
// flattened by line-height: 0 instead, to a point (ASCENT - DESCENT) / 2 above the baseline, near
// the middle of a typical Latin font's content area.
//
//   node scripts/space-font.ts          writes src/space/data.ts
//   node scripts/space-font.ts --check  fails if src/space/data.ts is out of date

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const OUTPUT = new URL("../src/space/data.ts", import.meta.url);

const UPEM = 1000;
const ASCENT = 800;
const DESCENT = 200;
const UNDERLINE_POSITION = -100;
const UNDERLINE_THICKNESS = 50;

class Writer {
  bytes: number[] = [];
  u8(v: number): this {
    this.bytes.push(v & 0xff);
    return this;
  }
  u16(v: number): this {
    return this.u8(v >> 8).u8(v);
  }
  i16(v: number): this {
    return this.u16(v < 0 ? v + 0x10000 : v);
  }
  u32(v: number): this {
    return this.u16(v >>> 16).u16(v & 0xffff);
  }
  tag(s: string): this {
    for (const c of s) this.u8(c.charCodeAt(0));
    return this;
  }
  zeros(n: number): this {
    for (let i = 0; i < n; ++i) this.u8(0);
    return this;
  }
  raw(b: number[]): this {
    this.bytes.push(...b);
    return this;
  }
}

// .notdef carries a 1-unit square so that glyf is never empty; it is never reached, since the cmap
// and the unicode-range both cover only the two spaces
const NOTDEF = new Writer()
  .i16(1) // numberOfContours
  .i16(0)
  .i16(0)
  .i16(1)
  .i16(1) // xMin yMin xMax yMax
  .u16(3) // endPtsOfContours[0]
  .u16(0) // instructionLength
  .u8(1)
  .u8(1)
  .u8(1)
  .u8(1) // flags: on-curve, int16 coordinates
  .i16(0)
  .i16(1)
  .i16(0)
  .i16(-1) // x deltas
  .i16(0)
  .i16(0)
  .i16(1)
  .i16(0) // y deltas
  .zeros(2).bytes; // pad to a 4-byte boundary

function head(): number[] {
  return new Writer()
    .u32(0x00010000) // version
    .u32(0x00010000) // fontRevision
    .u32(0) // checkSumAdjustment, patched below
    .u32(0x5f0f3cf5) // magicNumber
    .u16(0b1011) // flags: baseline at y=0, lsb at x=0, integer ppem
    .u16(UPEM)
    .zeros(16) // created, modified
    .i16(0)
    .i16(0)
    .i16(1)
    .i16(1) // xMin yMin xMax yMax
    .u16(0) // macStyle
    .u16(8) // lowestRecPPEM
    .i16(2) // fontDirectionHint
    .i16(0) // indexToLocFormat: short
    .i16(0).bytes; // glyphDataFormat
}

function hhea(): number[] {
  return new Writer()
    .u32(0x00010000)
    .i16(ASCENT) // ascender
    .i16(-DESCENT) // descender
    .i16(0) // lineGap
    .u16(0) // advanceWidthMax
    .i16(0)
    .i16(-1)
    .i16(1) // minLeftSideBearing minRightSideBearing xMaxExtent
    .i16(1)
    .i16(0)
    .i16(0) // caretSlopeRise caretSlopeRun caretOffset
    .zeros(8)
    .i16(0) // metricDataFormat
    .u16(2).bytes; // numberOfHMetrics
}

function maxp(): number[] {
  return new Writer()
    .u32(0x00010000)
    .u16(2) // numGlyphs
    .u16(4)
    .u16(1) // maxPoints maxContours
    .u16(0)
    .u16(0) // maxCompositePoints maxCompositeContours
    .u16(2) // maxZones
    .zeros(16).bytes;
}

function os2(): number[] {
  return new Writer()
    .u16(4) // version
    .i16(0) // xAvgCharWidth
    .u16(400)
    .u16(5) // usWeightClass usWidthClass
    .u16(0) // fsType: installable
    .i16(650)
    .i16(600)
    .i16(0)
    .i16(75) // subscript x/y size, x/y offset
    .i16(650)
    .i16(600)
    .i16(0)
    .i16(350) // superscript x/y size, x/y offset
    .i16(UNDERLINE_THICKNESS)
    .i16(250) // yStrikeoutSize yStrikeoutPosition
    .i16(0) // sFamilyClass
    .zeros(10) // panose
    .u32(0b11)
    .u32(0)
    .u32(0)
    .u32(0) // ulUnicodeRange: Basic Latin, Latin-1 Supplement
    .tag("GOLD")
    .u16(0x00c0) // fsSelection: REGULAR, USE_TYPO_METRICS
    .u16(0x20)
    .u16(0xa0) // usFirstCharIndex usLastCharIndex
    .i16(ASCENT) // sTypoAscender
    .i16(-DESCENT) // sTypoDescender
    .i16(0) // sTypoLineGap
    .u16(ASCENT) // usWinAscent
    .u16(DESCENT) // usWinDescent
    .u32(1)
    .u32(0) // ulCodePageRange: Latin 1
    .i16(0)
    .i16(0) // sxHeight sCapHeight
    .u16(0)
    .u16(0x20)
    .u16(0).bytes; // usDefaultChar usBreakChar usMaxContext
}

function hmtx(): number[] {
  return new Writer().u16(0).i16(0).u16(0).i16(0).bytes;
}

function cmap(): number[] {
  // format 4 with segments [U+0020], [U+00A0], [U+FFFF]; the first two map to glyph 1
  const ends = [0x20, 0xa0, 0xffff];
  const deltas = [1 - 0x20, 1 - 0xa0, 1];
  const sub = new Writer()
    .u16(4)
    .u16(16 + 8 * ends.length)
    .u16(0);
  sub
    .u16(2 * ends.length)
    .u16(4)
    .u16(1)
    .u16(2); // segCountX2 searchRange entrySelector rangeShift
  for (const e of ends) sub.u16(e);
  sub.u16(0);
  for (const e of ends) sub.u16(e);
  for (const d of deltas) sub.i16(d);
  for (const _ of ends) sub.u16(0);
  return new Writer()
    .u16(0)
    .u16(2) // version numTables
    .u16(0)
    .u16(3)
    .u32(20) // Unicode BMP
    .u16(3)
    .u16(1)
    .u32(20) // Windows Unicode BMP
    .raw(sub.bytes).bytes;
}

function name(): number[] {
  const records: [number, string][] = [
    [1, "Goldilocks Space"],
    [2, "Regular"],
    [3, "Goldilocks Space Regular"],
    [4, "Goldilocks Space Regular"],
    [6, "GoldilocksSpace-Regular"],
  ];
  const w = new Writer()
    .u16(0)
    .u16(records.length)
    .u16(6 + 12 * records.length);
  const strings = new Writer();
  for (const [id, text] of records) {
    const offset = strings.bytes.length;
    for (const c of text) strings.u16(c.charCodeAt(0));
    w.u16(3)
      .u16(1)
      .u16(0x409)
      .u16(id)
      .u16(2 * text.length)
      .u16(offset);
  }
  return w.raw(strings.bytes).bytes;
}

function post(): number[] {
  return new Writer()
    .u32(0x00030000)
    .u32(0) // italicAngle
    .i16(UNDERLINE_POSITION)
    .i16(UNDERLINE_THICKNESS)
    .u32(0) // isFixedPitch
    .zeros(16).bytes;
}

function loca(): number[] {
  return new Writer()
    .u16(0)
    .u16(NOTDEF.length / 2)
    .u16(NOTDEF.length / 2).bytes;
}

function checksum(b: number[]): number {
  let sum = 0;
  for (let i = 0; i < b.length; i += 4) {
    sum =
      (sum + ((b[i] << 24) | (b[i + 1] << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0))) >>> 0;
  }
  return sum;
}

function build(): Uint8Array {
  const tables: [string, number[]][] = [
    ["OS/2", os2()],
    ["cmap", cmap()],
    ["glyf", NOTDEF],
    ["head", head()],
    ["hhea", hhea()],
    ["hmtx", hmtx()],
    ["loca", loca()],
    ["maxp", maxp()],
    ["name", name()],
    ["post", post()],
  ];
  const n = tables.length;
  const dir = new Writer()
    .u32(0x00010000)
    .u16(n)
    .u16(128)
    .u16(3)
    .u16(16 * n - 128);
  const body = new Writer();
  let offset = 12 + 16 * n;
  let headOffset = 0;
  for (const [tag, data] of tables) {
    if (tag === "head") headOffset = offset;
    dir.tag(tag).u32(checksum(data)).u32(offset).u32(data.length);
    body.raw(data).zeros((4 - (data.length % 4)) % 4);
    offset += data.length + ((4 - (data.length % 4)) % 4);
  }
  const font = [...dir.bytes, ...body.bytes];
  const adjust = (0xb1b0afba - checksum(font)) >>> 0;
  font.splice(headOffset + 8, 4, ...new Writer().u32(adjust).bytes);
  return Uint8Array.from(font);
}

const font = build();
const hash = createHash("sha256").update(font).digest("hex").slice(0, 8);
const source = `// generated by scripts/space-font.ts; do not edit

export const FAMILY = "goldilocks-space-${hash}";

export const DATA =
  "${Buffer.from(font).toString("base64")}";
`;

if (process.argv.includes("--check")) {
  if (readFileSync(OUTPUT, "utf8") !== source) {
    console.error("src/space/data.ts is out of date; run node scripts/space-font.ts");
    process.exit(1);
  }
} else {
  writeFileSync(OUTPUT, source);
}
