# Builds the test fonts from DejaVu Sans (Bitstream Vera license; renamed as that license requires):
#
#   plain.ttf  Basic Latin, NBSP, soft hyphen and word joiner, with no OpenType layout features
#   kern.ttf   the same, plus kerning and a ligature that reach across U+0020 and U+00A0:
#                T + space  -400      space + A  -400      x space x -> Z
#
#   pip install fonttools && python3 test/fixtures/fonts.py [path/to/DejaVuSans.ttf]

import sys
from pathlib import Path

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

SOURCE = sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
HERE = Path(__file__).parent
CODEPOINTS = [*range(0x20, 0x7F), 0xA0, 0xAD, 0x2060]


def build(family: str, features: str | None) -> TTFont:
    font = TTFont(SOURCE)
    options = Options()
    options.layout_features = []
    options.name_IDs = [0, 13, 14]  # copyright and license notices stay with the font
    options.drop_tables += ["GSUB", "GPOS", "GDEF", "kern"]
    subsetter = Subsetter(options)
    subsetter.populate(unicodes=CODEPOINTS)
    subsetter.subset(font)
    name = font["name"]
    for nid, value in [(1, family), (2, "Book"), (3, family), (4, family), (6, family.replace(" ", ""))]:
        name.setName(value, nid, 3, 1, 0x409)
    if features:
        addOpenTypeFeaturesFromString(font, features)
    return font


def glyph(font: TTFont, cp: int) -> str:
    return font.getBestCmap()[cp]


plain = build("Goldi Plain Test", None)
plain.save(HERE / "plain.ttf")

probe = TTFont(SOURCE)
T, A, x, Z = (glyph(probe, ord(c)) for c in "TAxZ")
spaces = f"[{glyph(probe, 0x20)} {glyph(probe, 0xA0)}]"
FEATURES = f"""
languagesystem DFLT dflt;
languagesystem latn dflt;
feature kern {{
  pos {T} {spaces} -400;
  pos {spaces} {A} -400;
}} kern;
feature liga {{
  sub {x} {spaces} {x} by {Z};
}} liga;
"""
kern = build("Goldi Kern Test", FEATURES)
kern.save(HERE / "kern.ttf")
