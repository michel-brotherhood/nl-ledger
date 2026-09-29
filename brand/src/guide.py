"""Builds brand/index.html: one self-contained page (SVGs and Archivo inlined, no JavaScript)."""
import base64, glob, json, os, re, html
def lum(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    c = [x/12.92 if x <= .03928 else ((x+.055)/1.055)**2.4 for x in c]
    return .2126*c[0] + .7152*c[1] + .0722*c[2]
def cr(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True); return (la+.05)/(lb+.05)
PAIRS = [  # (mode, use, fg, bg, need)
 ('Light','Body text','#14171a','#fcfcfa',4.5),('Light','Secondary text','#454b52','#fcfcfa',4.5),('Light','Muted text, source lines','#676d74','#fcfcfa',4.5),
 ('Light','Wordmark and icon in blue','#1f3c96','#fcfcfa',3),('Light','Wordmark in ink','#14171a','#fcfcfa',3),
 ('Light','Wordmark on blue field','#ffffff','#1f3c96',3),('Light','Secondary text on blue','#cdd7f5','#1f3c96',4.5),
 ('Light','Chart bar','#2f57c4','#fcfcfa',3),('Light','Negative figure','#b3261e','#fcfcfa',4.5),('Light','Annotation lead line','#59606a','#fcfcfa',3),
 ('Light','Text on gold call-out','#1a1406','#f0b323',4.5),
 ('Dark','Body text','#eceeea','#0f1215',4.5),('Dark','Secondary text','#b9bfc6','#0f1215',4.5),('Dark','Muted text, source lines','#8f969d','#0f1215',4.5),
 ('Dark','Icon and links in light blue','#9db4f5','#0f1215',3),('Dark','Wordmark in ink','#eceeea','#0f1215',3),
 ('Dark','Wordmark on blue field','#ffffff','#1d377f',3),('Dark','Secondary text on blue','#bccaf0','#1d377f',4.5),
 ('Dark','Chart bar','#5f86ea','#0f1215',3),('Dark','Negative figure','#ff8d84','#0f1215',4.5),('Dark','Annotation lead line','#9aa2ab','#0f1215',3),
]
rows = ''.join(f'<tr><td>{m}</td><td>{u}</td><td><i style="background:{f}"></i>{f}</td><td><i style="background:{b}"></i>{b}</td><td class="r">{cr(f,b):.2f}:1</td><td class="r">{n}:1</td><td>{"Pass" if cr(f,b)>=n else "FAIL"}</td></tr>' for m,u,f,b,n in PAIRS)
fails = [p for p in PAIRS if cr(p[2],p[3]) < p[4]]
print('contrast fails:', fails)
def svg(path, cls=''):
    s = open(path).read().strip()
    s = re.sub(r'<title>.*?</title>', '', s)
    return s.replace('<svg ', f'<svg class="{cls}" ', 1) if cls else s
def tile(label, inner, ground):
    return f'<figure class="tile {ground}">{inner}<figcaption>{label}</figcaption></figure>'
font = base64.b64encode(open('site/static/fonts/archivo-roman.woff2','rb').read()).decode()
C = json.load(open('brand/src/chart-data.json'))
def table(caption, head, body):
    return f'<details><summary>Table equivalent</summary><table><caption>{caption}</caption><thead><tr>{"".join(f"<th>{h}</th>" for h in head)}</tr></thead><tbody>{"".join("<tr>"+"".join(f"<td>{c}</td>" for c in r)+"</tr>" for r in body)}</tbody></table></details>'
t1 = table('Current-account spending by department, 2024-25, $ millions', ['Department','$ millions','Share'],
   [[html.escape(n), f'{v["actual"]:,.1f}', f'{v["actual"]/C["total"]*100:.1f}%'] for n,v in C['top']] + [[f'{C["rest_n"]} more departments', f'{C["rest_sum"]:,.1f}', f'{C["rest_sum"]/C["total"]*100:.1f}%'], ['Total', f'{C["total"]:,.1f}', '100%']])
t2 = table('Actual against original estimate, 2024-25, $ millions', ['Department','Actual','Original estimate','Difference'],
   [[html.escape(n), f'{v["actual"]:,.1f}', f'{v["est"]:,.1f}', (f'+{(v["actual"]/v["est"]-1)*100:.1f}%' if v['actual']>=v['est'] else f'({(1-v["actual"]/v["est"])*100:.1f}%)')] for n,v in C['pick']])
def inv():
    out = ''
    for d in ('svg','png','favicon','social','charts'):
        fs = sorted(glob.glob(f'brand/{d}/*'))
        out += f'<h3>{d}/</h3><table class="inv"><tbody>' + ''.join(f'<tr><td>{os.path.basename(f)}</td><td class="r">{os.path.getsize(f)/1024:.1f} KB</td></tr>' for f in fs) + '</tbody></table>'
    return out
def sizes_icon(fill, ground):
    return ''.join(f'<span class="sz"><span style="width:{n}px;height:{n}px;display:block">{svg(f"brand/svg/icon-{'nl-' if n <= 32 else ''}{fill}.svg")}</span><small>{n}{' NL alone' if n <= 32 else ''}</small></span>' for n in (16,32,48,64,180))
def sizes_wm(fill, ground):
    return ''.join(f'<span class="sz"><span style="height:{n}px;display:block">{svg(f"brand/svg/wordmark-{fill}.svg","w")}</span><small>{n}px tall</small></span>' for n in (24,48))
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NL Ledger brand guide</title>
<meta name="color-scheme" content="light dark"><link rel="icon" href="favicon/favicon.svg" type="image/svg+xml">
<style>
@font-face{{font-family:Archivo;src:url(data:font/woff2;base64,{font}) format("woff2");font-weight:100 900;font-stretch:62% 125%}}
:root{{--paper:#fcfcfa;--paper2:#f1f2ef;--ink:#14171a;--ink2:#454b52;--ink3:#676d74;--hair:#d3d6d1;--blue:#1f3c96;--link:#1f3c96;--night:#0f1215}}
@media (prefers-color-scheme:dark){{:root{{--paper:#0f1215;--paper2:#171b20;--ink:#eceeea;--ink2:#b9bfc6;--ink3:#8f969d;--hair:#2e343a;--link:#a4bbff}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:400 1.0625rem/1.55 Archivo,ui-sans-serif,system-ui,sans-serif}}
main{{max-width:76rem;margin:auto;padding:0 clamp(1rem,4vw,2.5rem) 5rem}}
header.top{{background:#1f3c96;color:#fff;padding:clamp(2.5rem,7vw,5rem) clamp(1rem,4vw,2.5rem)}}header.top>div{{max-width:76rem;margin:auto}}
header.top svg{{height:clamp(2.2rem,8vw,4.2rem);width:auto;display:block}}header.top p{{margin:1.4rem 0 0;color:#cdd7f5;max-width:44rem}}
h2{{font-stretch:72%;font-weight:850;text-transform:uppercase;letter-spacing:.012em;font-size:clamp(1.5rem,3.2vw,2.1rem);line-height:1.02;margin:4.5rem 0 1rem;padding-top:1rem;border-top:1.5px solid var(--ink)}}
h3{{font-stretch:78%;font-weight:800;text-transform:uppercase;letter-spacing:.07em;font-size:.78rem;margin:2rem 0 .6rem;color:var(--ink2)}}
p,li{{max-width:68ch}}a{{color:var(--link)}}code{{font-size:.9em}}
.grid{{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))}}
.tile{{margin:0;padding:1.6rem;min-height:9rem;display:flex;flex-direction:column;justify-content:space-between;gap:1.4rem;border:1px solid var(--hair)}}
.tile figcaption,.sz small{{font-size:.78rem;color:inherit;opacity:.8;font-stretch:90%}}
.tile.paper{{background:#fcfcfa;color:#14171a}}.tile.blue{{background:#1f3c96;color:#fff}}.tile.night{{background:#0f1215;color:#eceeea}}
.tile svg{{max-width:100%;display:block}}.tile .w{{height:auto;width:100%;max-width:26rem}}
.row{{display:flex;flex-wrap:wrap;align-items:flex-end;gap:1.4rem}}.sz{{display:flex;flex-direction:column;gap:.5rem;align-items:flex-start}}.sz svg{{height:100%;width:auto;display:block}}
.ground{{padding:1.6rem;border:1px solid var(--hair)}}.ground.paper{{background:#fcfcfa;color:#14171a}}.ground.blue{{background:#1f3c96;color:#fff}}.ground.night{{background:#0f1215;color:#eceeea}}
table{{border-collapse:collapse;width:100%;font-size:.95rem;font-variant-numeric:tabular-nums lining-nums}}th{{font-stretch:78%;font-weight:800;text-transform:uppercase;letter-spacing:.07em;font-size:.72rem;text-align:left;border-bottom:1.5px solid var(--ink);padding:.4rem .6rem .4rem 0}}
td{{border-bottom:1px solid var(--hair);padding:.4rem .6rem .4rem 0}}td.r{{text-align:right}}td i{{display:inline-block;width:.9em;height:.9em;margin-right:.45em;vertical-align:-.1em;border:1px solid var(--hair)}}caption{{text-align:left;color:var(--ink2);padding-bottom:.4rem}}
.scroll{{overflow-x:auto}}.narrow{{display:none}}@media (max-width:40rem){{.wide{{display:none}}.narrow{{display:block}}}}.chart{{margin:1.4rem 0 .4rem;max-width:46rem}}.chart svg{{display:block;width:100%;height:auto}}
details{{margin:.6rem 0 2rem;max-width:46rem}}summary{{cursor:pointer;font-stretch:78%;font-weight:800;text-transform:uppercase;letter-spacing:.07em;font-size:.78rem;color:var(--ink2)}}
ul.rules{{padding-left:1.1rem}}ul.rules li{{margin:.35rem 0}}.inv td:first-child{{font-family:ui-monospace,monospace;font-size:.85rem}}
.swatch{{display:flex;align-items:flex-end;min-height:5.5rem;padding:.7rem;font-size:.85rem;font-stretch:90%}}
.spec dt{{font-weight:800;margin-top:.8rem}}.spec dd{{margin:0;color:var(--ink2)}}
</style></head><body>
<header class="top"><div>{svg("brand/svg/wordmark-white.svg")}<p>Brand guide. The name is the logo, the stacked lockup is the mark and app icon, the stacked mark is also the tab icon, and blue is the ground. Charts keep the ruled-schedule look of the site.</p></div></header><main>

<h2>Wordmark</h2>
<p>The name set alone in Archivo cut at weight 900 and width 64, spaced by eye letter pair by letter pair, outlined to paths. No box, no symbol beside it. The stacked version sets NL over LEDGER at one width and is the mark.</p>
<div class="grid">
{tile("wordmark-color.svg", svg("brand/svg/wordmark-color.svg","w"), "paper")}
{tile("wordmark-black.svg (one-colour ink)", svg("brand/svg/wordmark-black.svg","w"), "paper")}
{tile("wordmark-white.svg (reversed on the blue field)", svg("brand/svg/wordmark-white.svg","w"), "blue")}
{tile("wordmark-white.svg on night paper", svg("brand/svg/wordmark-white.svg","w"), "night")}
{tile("wordmark-stacked-color.svg", '<div style="max-width:15rem">'+svg("brand/svg/wordmark-stacked-color.svg","w")+'</div>', "paper")}
{tile("wordmark-stacked-white.svg", '<div style="max-width:15rem">'+svg("brand/svg/wordmark-stacked-white.svg","w")+'</div>', "blue")}
</div>
<h3>Small sizes</h3>
<div class="grid"><div class="ground paper"><div class="row">{sizes_wm("color","paper")}</div></div><div class="ground blue"><div class="row">{sizes_wm("white","blue")}</div></div><div class="ground night"><div class="row">{sizes_wm("white","night")}</div></div></div>
<ul class="rules"><li>Least height 24px on screens; the site masthead uses 24px.</li><li>Clear space on every side: the height of the letter L.</li><li>Colours: Estimates Blue on paper, white on blue or night paper, accounting ink for one-colour print. No other colours, no gradients, no outlines, no effects.</li><li>Never set beside another mark, inside a box or tile, or in another typeface.</li></ul>

<h2>Mark and icons</h2>
<p>The mark is the stacked lockup: NL over LEDGER, both set to one width, so it sits in a square. The browser-tab favicon uses the full stack in blue at every size, keeping the shape even where LEDGER is too small to read; it turns light blue in dark mode so it shows on dark tabs. The NL-only variants remain in the kit for places that need a single letter pair. Sharp corners, no box in the artwork; the only tile is the full-bleed blue square of the app icon.</p>
<div class="grid">
<div class="ground paper"><div class="row">{sizes_icon("color","paper")}</div></div><div class="ground blue"><div class="row">{sizes_icon("white","blue")}</div></div><div class="ground night"><div class="row">{sizes_icon("white","night")}</div></div></div>
<div class="grid" style="margin-top:12px">
{tile("app-icon.svg: 180, 192, 512 (favicon/)", '<img alt="" src="data:image/png;base64,'+base64.b64encode(open("brand/favicon/apple-touch-icon.png","rb").read()).decode()+'" width="96" height="96">', "paper")}
{tile("app-icon-maskable.svg: smaller, for round and squircle masks", '<img alt="" src="data:image/png;base64,'+base64.b64encode(open("brand/favicon/icon-512-maskable.png","rb").read()).decode()+'" width="96" height="96">', "paper")}
{tile("favicon.svg: stacked mark", '<img alt="" width="64" height="64" src="data:image/svg+xml;base64,'+base64.b64encode(open("brand/svg/favicon.svg","rb").read()).decode()+'">', "paper")}
{tile("icon-black.svg", '<div style="width:96px">'+svg("brand/svg/icon-black.svg")+'</div>', "paper")}
</div>
<p>favicon.svg switches to a lighter blue (#9db4f5) when the browser is in dark mode.</p>

<h2>Colour</h2>
<p>The site's colours, unchanged. The identity adds none.</p>
<div class="grid">
<div class="swatch" style="background:#1f3c96;color:#fff">Estimates Blue #1f3c96, the ground</div><div class="swatch" style="background:#fcfcfa;color:#14171a;border:1px solid var(--hair)">Bond Paper #fcfcfa</div><div class="swatch" style="background:#14171a;color:#fcfcfa">Accounting Ink #14171a</div><div class="swatch" style="background:#0f1215;color:#eceeea;border:1px solid var(--hair)">Night Paper #0f1215, Night Ink #eceeea</div><div class="swatch" style="background:#2f57c4;color:#fff">Bar Blue #2f57c4 (dark: #5f86ea)</div><div class="swatch" style="background:#f0b323;color:#1a1406">Flag Gold #f0b323, 1:1 call-out only</div><div class="swatch" style="background:#fcfcfa;color:#b3261e;border:1px solid var(--hair)">Red Ink #b3261e, negative figures only</div>
</div>
<h3>Contrast, measured (WCAG 2.2 AA; 4.5:1 text, 3:1 marks)</h3>
<div class="scroll"><table><thead><tr><th>Mode</th><th>Pairing</th><th>Foreground</th><th>Background</th><th>Ratio</th><th>Needs</th><th></th></tr></thead><tbody>{rows}</tbody></table></div>
<p>Bar Ghost (#c3cadb) is 1.6:1 on paper. It is a background tint only and never carries data alone.</p>

<h2>Type</h2>
<p>One family, Archivo (variable, SIL Open Font License, self-hosted in <code>site/static/fonts/</code>, copied to <code>brand/fonts/</code>). The wordmark is outlined; chart text uses the site's own styles.</p>
<div class="ground paper"><div style="font:850 clamp(2.4rem,7vw,4.5rem)/1 Archivo;font-stretch:68%;letter-spacing:-.02em">$10.6 billion</div><p style="margin:.6rem 0 0;color:#454b52">Body: Archivo 400, width 100, 1.0625rem on 1.55.</p></div>

<h2>Chart style</h2>
<p>The site's schedules and receipt, extended. A chart is a ruled table with marks in it.</p>
<dl class="spec">
<dt>Title</dt><dd>States the finding as a sentence, in the site's caps heading (Archivo 850, width 72). Two lines at most.</dd>
<dt>One annotation</dt><dd>One short written note on the chart, joined to the mark it explains by a 1px graphite lead line. Ink, 12.5px, weight 600.</dd>
<dt>Marks</dt><dd>Bars 8px thick, square at the baseline and rounded 4px at the data end. Brand blue only (#2f57c4; dark #5f86ea). One series, one colour. Direction or ranking carries meaning, not hue.</dd>
<dt>Rules</dt><dd>Caps column headers over a 1.5px ink rule, hairline rows, total on a double rule. Generous row height (36px). No gridlines, no axes with ticks, no fills, no shadow.</dd>
<dt>Figures</dt><dd>Tabular lining numerals, right-aligned. Negative figures in red ink and parentheses, as in the schedules.</dd>
<dt>Source line</dt><dd>Muted, under every chart, naming the document and page.</dd>
<dt>Table equivalent</dt><dd>Every chart ships with the same numbers as a table.</dd>
<dt>Phones</dt><dd>Each chart has a 360-wide layout (chart-*-phone.svg) with the name above its bar, so text stays at reading size on a phone. Use it below 40rem.</dd><dt>Dark mode</dt><dd>The SVG carries its own dark values and follows the reader's system setting.</dd>
</dl>
<div class="chart wide">{svg("brand/charts/chart-share.svg")}</div><div class="chart narrow">{svg("brand/charts/chart-share-phone.svg")}</div>{t1}
<div class="chart wide">{svg("brand/charts/chart-estimate.svg")}</div><div class="chart narrow">{svg("brand/charts/chart-estimate-phone.svg")}</div>{t2}

<h2>Share images</h2>
<p>1200x630 for links, 1280x640 for the GitHub social preview. Blue field, the wordmark, one real figure with its year and source, the address.</p>
<div class="grid"><img alt="Share image" style="width:100%;height:auto;border:1px solid var(--hair)" src="data:image/png;base64,{base64.b64encode(open("brand/social/og.png","rb").read()).decode()}"></div>

<h2>Files</h2>
{inv()}
</main></body></html>'''
open('brand/index.html', 'w').write(page)
print(len(page)//1024, 'KB')
