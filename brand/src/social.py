"""Writes brand/src/og.html (1200x630 and 1280x640 layouts) and renders og.png and github-social-preview.png.
The figure and year come from the built site data; the address comes from SITE.url in site/lib/format.mjs at run time. Needs node + playwright (see shot.cjs)."""
import re, subprocess, os
root = os.getcwd()
site = re.search(r'url:\s*"https?://([^"]+)"', open('site/lib/format.mjs').read()).group(1)
# the figure, year and source are the ones on the site's home page (site/dist/data/receipt.json)
import json
R = json.load(open('site/dist/data/receipt.json'))
fy, total = R['year'], f"${R['total']/1e9:.1f} billion"
wm = open('brand/svg/wordmark-white.svg').read()
wm = re.sub(r'<title>.*?</title>', '', wm)
font = '../../site/static/fonts/archivo-roman.woff2'  # relative to brand/src/, where the page is written
def page(w, h):
    k = w / 1200
    return f'''<!doctype html><meta charset="utf-8"><style>
@font-face{{font-family:Archivo;src:url({font});font-weight:100 900;font-stretch:62% 125%}}
*{{box-sizing:border-box;margin:0}}body{{width:{w}px;height:{h}px;background:#1f3c96;color:#fff;font-family:Archivo;position:relative;overflow:hidden}}
.wm{{position:absolute;left:{72*k}px;top:{64*k}px}} .wm svg{{height:{56*k}px;width:auto;display:block}}
.fig{{position:absolute;left:{66*k}px;bottom:{196*k}px;font-size:{236*k}px;font-weight:850;font-stretch:68%;letter-spacing:-.02em;line-height:.9;white-space:nowrap}}
.rule{{position:absolute;left:{72*k}px;right:{72*k}px;bottom:{150*k}px;height:{5*k}px;border-block:{1.5*k}px solid #fff}}
.cap{{position:absolute;left:{72*k}px;bottom:{78*k}px;font-size:{27*k}px;line-height:1.35;color:#cdd7f5;max-width:{800*k}px}}
.url{{position:absolute;right:{72*k}px;bottom:{78*k}px;font-size:{27*k}px;font-weight:800;font-stretch:78%;letter-spacing:.07em;text-transform:uppercase;color:#fff}}
</style><div class="wm">{wm}</div><div class="fig">{total}</div><div class="rule"></div>
<div class="cap">Spent by the province in {fy}, all 20 departments.<br>Source: Program Expenditures and Revenues report, {fy}.</div><div class="url">{site}</div>'''
for name, w, h in (('og', 1200, 630), ('github-social-preview', 1280, 640)):
    open(f'brand/src/{name}.html', 'w').write(page(w, h))
    subprocess.run(['node', 'brand/src/shot.cjs', f'brand/src/{name}.html', f'brand/social/{name}.png', str(w), '1', str(h)], check=True)
print(site)
