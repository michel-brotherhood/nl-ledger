"""Cuts the NL Ledger wordmark from Archivo (wght 900, wdth 66) and spaces it by hand.
Run with a Python that has fonttools: python brand/src/wordmark.py
Writes brand/src/wordmark.json (paths in font units, cap height 686)."""
import json, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

W, WD = 900, float(sys.argv[1]) if len(sys.argv) > 1 else 64
f = TTFont('site/static/fonts/archivo-roman.woff2')
f = instantiateVariableFont(f, {'wght': W, 'wdth': WD})
gs, cmap = f.getGlyphSet(), f.getBestCmap()
def glyph(ch):
    n = cmap[ord(ch)]
    bp = BoundsPen(gs); gs[n].draw(bp)
    return n, bp.bounds
# gap after each letter (font units), by the pair of edges facing each other
GAP = {'NL': 74, 'L_': 0, 'LE': 44, 'ED': 58, 'DG': 40, 'GE': 48, 'ER': 58}
SPACE = 150  # between NL and LEDGER, visible gap after L
def layout(text, tracking=0):
    x, out = 0, []
    prev = None
    for ch in text:
        if ch == ' ':
            x += SPACE; prev = ' '; continue
        n, b = glyph(ch)
        if prev and prev != ' ':
            x += GAP.get(prev + ch, 56)
        elif prev == ' ':
            pass
        out.append((ch, n, x - b[0], b))
        x = x - b[0] + b[2]
        prev = ch
    return out, x
def svgpath(n, dx, dy=0, s=1.0):
    p = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    # flip y: font y-up -> svg y-down, cap height 686 sits at y=0..686
    gs[n].draw(TransformPen(p, (s, 0, 0, -s, dx*s, (686+dy)*s)))
    return p.getCommands()
res = {}
for key, text in (('nl', 'NL'), ('ledger', 'LEDGER'), ('line', 'NL LEDGER')):
    items, width = layout(text)
    res[key] = {'w': round(width, 1), 'items': [(ch, svgpath(n, dx)) for ch, n, dx, b in items]}
json.dump(res, open('brand/src/wordmark.json', 'w'))
print({k: v['w'] for k, v in res.items()})
