import { FAMILY } from "./data.ts";

// every space is drawn by the Goldilocks space font inside its own element, so that no shaping
// (kerning, ligatures) reaches across it; line-height: 0 flattens the element to a zero-height box
// that leaves the line box alone, and its width comes from word-spacing alone, since the glyph has
// zero advance
export const TAG = "goldi-space";

// the natural width of a space, relative to that of the surrounding font
export const RATIO = 2 / 3;

export const WIDTH = "--goldi-space-width";

export const RULE = `${TAG}{font-family:"${FAMILY}";word-spacing:var(${WIDTH});line-height:0;font-synthesis:none}`;
