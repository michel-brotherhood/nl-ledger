"""Writes the master SVGs into brand/svg from wordmark.json and the icon geometry."""
import json, os
D = json.load(open('brand/src/wordmark.json'))
INK = {'color': '#1f3c96', 'black': '#14171a', 'white': '#ffffff'}
H = 686
def paths(key, dx=0, dy=0, s=1.0):
    ps = ''
    for ch, d in D[key]['items']:
        ps += d
    return ps
def group(key, x, y, s):
    return f'<path transform="translate({x:g} {y:g}) scale({s:g})" d="{paths(key)}"/>'
def wordmark(fill):
    w = round(D['line']['w'])
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -14 {w} {H+28}" role="img" aria-label="NL Ledger"><title>NL Ledger</title><path fill="{fill}" d="{paths("line")}"/></svg>'
def stacked(fill):
    # NL and LEDGER set to the same width, cap heights follow the scale
    wl = D['ledger']['w']; wn = D['nl']['w']
    s = wl / wn                      # NL scaled up to LEDGER's width
    gap = 90
    hn = H * s
    tot = hn + gap + H
    body = f'<path transform="scale({s:.4f})" d="{paths("nl")}"/><path transform="translate(0 {hn+gap:.1f})" d="{paths("ledger")}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -14 {round(wl)} {round(tot)+28}" role="img" aria-label="NL Ledger"><title>NL Ledger</title><g fill="{fill}">{body}</g></svg>'
# The mark is the stacked lockup (NL over LEDGER, one width). Where LEDGER cannot be read
# (32px and below) the big NL stands alone. Both sit in a square canvas.
GAPU = 90
WL = D['ledger']['w']; WN = D['nl']['w']; SC = WL / WN
HS = H * SC + GAPU + H              # stacked height in font units
def stacked_in(box, frac):
    """Stacked lockup centred in a box x box square, its width = frac * box."""
    k = frac * box / WL
    ox = (box - WL * k) / 2; oy = (box - HS * k) / 2
    return (f'<g transform="translate({ox:.2f} {oy:.2f}) scale({k:.5f})"><path transform="scale({SC:.4f})" d="{paths("nl")}"/>'
            f'<path transform="translate(0 {H*SC+GAPU:.1f})" d="{paths("ledger")}"/></g>')
def nl_in(box, frac):
    k = frac * box / WN
    ox = (box - WN * k) / 2; oy = (box - H * k) / 2
    return f'<path transform="translate({ox:.2f} {oy:.2f}) scale({k:.5f})" d="{paths("nl")}"/>'
def sq(inner, bg=None, extra=''):
    r = f'<rect width="1000" height="1000" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="NL Ledger"><title>NL Ledger</title>{extra}{r}{inner}</svg>'
out = {}
for k, c in INK.items():
    out[f'wordmark-{k}.svg'] = wordmark(c)
    out[f'wordmark-stacked-{k}.svg'] = stacked(c)
    out[f'icon-{k}.svg'] = sq(f'<g fill="{c}">{stacked_in(1000, .9)}</g>')
    out[f'icon-nl-{k}.svg'] = sq(f'<g fill="{c}">{nl_in(1000, .94)}</g>')
# app icons: white on Estimates Blue, full bleed. 'any' (apple-touch, 192, 512) and a smaller maskable
out['app-icon.svg'] = sq(f'<g fill="#fff">{stacked_in(1000, .70)}</g>', '#1f3c96')
out['app-icon-maskable.svg'] = sq(f'<g fill="#fff">{stacked_in(1000, .54)}</g>', '#1f3c96')
out['app-icon-nl.svg'] = sq(f'<g fill="#fff">{nl_in(1000, .70)}</g>', '#1f3c96')
out['favicon.svg'] = sq(stacked_in(1000, .96), None, '<style>path{fill:#1f3c96}@media (prefers-color-scheme:dark){path{fill:#9db4f5}}</style>')
for n, t in out.items():
    open(f'brand/svg/{n}', 'w').write(t + '\n')
print(len(out))
