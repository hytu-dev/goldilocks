import { DATA, FAMILY } from "./data.ts";

let loaded: Promise<FontFace> | undefined;

export function load(): Promise<FontFace> {
  if (!loaded) {
    const face = new FontFace(FAMILY, bytes(), { unicodeRange: "U+20, U+A0" });
    document.fonts.add(face);
    loaded = face.load();
  }
  return loaded;
}

// helpers -----------------------------------------------------------------------------------------

function bytes(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(DATA), (c) => c.charCodeAt(0));
}
