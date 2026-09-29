"""Draws the two worked chart examples from the ledger database (read-only) into brand/charts/*.svg
and writes brand/src/chart-data.json. Usage: python brand/src/charts.py [path/to/ledger.db]"""
import sqlite3, json, sys, os, html
DB = sys.argv[1] if len(sys.argv) > 1 else 'data/build/ledger.db'
q = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
rows = q.execute("""select department, sum(col1), sum(col3), min(page) from programs
 where fiscal_year='2024-25' and kind='actual' and line_type='object' and account='CURRENT'
 group by department order by sum(col1) desc""").fetchall()
D = {r[0]: dict(actual=r[1]/1e6, est=r[2]/1e6, page=r[3]) for r in rows}
total = sum(v['actual'] for v in D.values())
SRC = 'Report on the Program Expenditures and Revenues of the Consolidated Revenue Fund, 2024-25'
STYLE = '''<style>
.nlchart{--paper:#fcfcfa;--ink:#14171a;--ink2:#454b52;--ink3:#676d74;--hair:#d3d6d1;--bar:#2f57c4;--red:#b3261e;--graphite:#59606a;font-family:Archivo,ui-sans-serif,system-ui,sans-serif}
@media (prefers-color-scheme:dark){.nlchart{--paper:#0f1215;--ink:#eceeea;--ink2:#b9bfc6;--ink3:#8f969d;--hair:#2e343a;--bar:#5f86ea;--red:#ff8d84;--graphite:#9aa2ab}}
.nlchart .bg{fill:var(--paper)}.nlchart .t{fill:var(--ink);font-weight:850;font-stretch:72%;text-transform:uppercase;letter-spacing:.012em;font-size:23px}
.nlchart .h{fill:var(--ink2);font-weight:800;font-stretch:78%;text-transform:uppercase;letter-spacing:.07em;font-size:11px}
.nlchart .l{fill:var(--ink);font-size:14px;font-stretch:90%}.nlchart .n{fill:var(--ink);font-size:14px;font-variant-numeric:tabular-nums lining-nums}
.nlchart .neg{fill:var(--red)}.nlchart .a{fill:var(--ink);font-size:12.5px;font-weight:600;font-stretch:85%}.nlchart .s{fill:var(--ink3);font-size:11px;font-stretch:90%}
.nlchart .bar{fill:var(--bar)}.nlchart .hair{stroke:var(--hair)}.nlchart .rule{stroke:var(--ink)}.nlchart .lead{stroke:var(--graphite);fill:none}
</style>'''
def esc(s): return html.escape(s, quote=False)
def bar(x, y, w, h=8, dir=1):
    """A thin bar, square at the baseline and rounded 4px at the data end (dir=1 grows right, -1 left)."""
    if w < 4: w = 4
    r = min(4, w/2, h/2)
    x0, x1 = (x, x + w) if dir == 1 else (x - w, x)
    if dir == 1:
        return f'<path class="bar" d="M{x0:.1f} {y}H{x1-r:.1f}a{r} {r} 0 0 1 {r} {r}v{h-2*r}a{r} {r} 0 0 1 -{r} {r}H{x0:.1f}z"/>'
    return f'<path class="bar" d="M{x1:.1f} {y}H{x0+r:.1f}a{r} {r} 0 0 0 -{r} {r}v{h-2*r}a{r} {r} 0 0 0 {r} {r}H{x1:.1f}z"/>'
def wrap(title_lines, body, h, label):
    t = ''.join(f'<text class="t" x="0" y="{28+i*26}">{esc(l)}</text>' for i, l in enumerate(title_lines))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" class="nlchart" viewBox="0 0 720 {h}" role="img" aria-label="{esc(label)}">{STYLE}'
            f'<rect class="bg" width="720" height="{h}"/><title>{esc(label)}</title>{t}{body}</svg>')
def fmt(v): return f'{v:,.1f}'

# ---- Chart 1: share of current-account spending
top = list(D.items())[:6]
rest = list(D.items())[6:]
rest_sum = sum(v['actual'] for _, v in rest)
share = top[0][1]['actual'] / total
cents = round(share * 100)
y0 = 84; RH = 36; x0, sc = 258, 280/top[0][1]['actual']
b = f'<text class="h" x="0" y="{y0-10}">Department</text><text class="h" x="720" y="{y0-10}" text-anchor="end">$ millions</text><line class="rule" x1="0" x2="720" y1="{y0}" y2="{y0}" stroke-width="1.5"/>'
NAMES = {'Children, Seniors and Social Development':'Children, Seniors and Social Dev.', 'Transportation and Infrastructure':'Transportation and Infrastructure'}
for i, (name, v) in enumerate(top):
    y = y0 + i*RH
    b += f'<line class="hair" x1="0" x2="720" y1="{y+RH}" y2="{y+RH}"/><text class="l" x="0" y="{y+23}">{esc(NAMES.get(name,name))}</text>'
    b += bar(x0, y+14, v['actual']*sc)
    b += f'<text class="n" x="720" y="{y+23}" text-anchor="end">{fmt(v["actual"])}</text>'
ya = y0 + 14 + 4
ax = x0 + top[0][1]['actual']*sc + 8
b += f'<line class="lead" x1="{ax:.0f}" x2="{ax+14:.0f}" y1="{ya}" y2="{ya}"/><text class="a" x="{ax+20:.0f}" y="{ya+4}">{cents}¢ of every $1</text>'
yr = y0 + 6*RH
b += f'<line class="hair" x1="0" x2="720" y1="{yr+RH}" y2="{yr+RH}"/><text class="l" x="0" y="{yr+23}">{len(rest)} more departments</text>{bar(x0, yr+14, rest_sum*sc)}<text class="n" x="720" y="{yr+23}" text-anchor="end">{fmt(rest_sum)}</text>'
yt = yr + RH + 2
b += f'<line class="rule" x1="0" x2="720" y1="{yt}" y2="{yt}" stroke-width="1.5"/><line class="rule" x1="0" x2="720" y1="{yt+4}" y2="{yt+4}" stroke-width="1.5"/>'
b += f'<text class="l" x="0" y="{yt+26}" style="font-weight:800">Total, current account</text><text class="n" x="720" y="{yt+26}" text-anchor="end" style="font-weight:800">{fmt(total)}</text>'
b += f'<text class="s" x="0" y="{yt+56}">Source: {esc(SRC)}, department statements (Health, p. {top[0][1]["page"]}).</text>'
h1 = yt + 68
title1 = [f'Health took {cents} cents of every dollar', 'of day-to-day spending in 2024-25']
open('brand/charts/chart-share.svg', 'w').write(wrap(title1, b, h1, f'Bar chart. Health and Community Services spent ${fmt(top[0][1]["actual"])} million of ${fmt(total)} million, {cents} cents of every dollar.') + '\n')

# ---- Chart 2: actual against original estimate
pick = ['Health and Community Services','Transportation and Infrastructure','Children, Seniors and Social Development','Executive Council','Industry, Energy and Technology','Consolidated Fund Services']
pick.sort(key=lambda n: D[n]['actual']/D[n]['est'], reverse=True)
zx, per = 470, 230/30
y0 = 108
b = f'<text class="h" x="0" y="{y0-10}">Department</text><text class="h" x="{zx-6}" y="{y0-10}" text-anchor="end">Spent less</text><text class="h" x="{zx+6}" y="{y0-10}">Spent more</text><text class="h" x="720" y="{y0-10}" text-anchor="end">vs estimate</text>'
b += f'<line class="rule" x1="0" x2="720" y1="{y0}" y2="{y0}" stroke-width="1.5"/>'
ind = D['Industry, Energy and Technology']
for i, n in enumerate(pick):
    v = D[n]; d = (v['actual']/v['est'] - 1)*100
    y = y0 + i*RH
    b += f'<line class="hair" x1="0" x2="720" y1="{y+RH}" y2="{y+RH}"/><text class="l" x="0" y="{y+23}">{esc(NAMES.get(n,n))}</text>'
    b += bar(zx, y+14, abs(d)*per, dir=1 if d >= 0 else -1)
    txt = f'{d:+.1f}%' if d >= 0 else f'({abs(d):.1f}%)'
    b += f'<text class="n{"" if d>=0 else " neg"}" x="720" y="{y+23}" text-anchor="end">{txt}</text>'
    if n == 'Industry, Energy and Technology':
        ay = y + 18
        b += f'<line class="lead" x1="{zx+8}" x2="{zx+22}" y1="{ay}" y2="{ay}"/><text class="a" x="{zx+28}" y="{ay-2}">${fmt(v["actual"])}M spent</text><text class="a" x="{zx+28}" y="{ay+12}" style="font-weight:400">of ${fmt(v["est"])}M planned</text>'
b += f'<line class="rule" x1="{zx}" x2="{zx}" y1="{y0-4}" y2="{y0+len(pick)*RH}" stroke-width="1.5"/>'
yf = y0 + len(pick)*RH
b += f'<text class="s" x="0" y="{yf+26}">Actual spending against the original estimate, current account.</text><text class="s" x="0" y="{yf+42}">Source: {esc(SRC)}.</text>'
title2 = ['Industry, Energy and Technology spent 23.5%', 'under its estimate; Health spent 2.3% over']
pct = lambda n: (D[n]['actual']/D[n]['est']-1)*100
assert f"{-pct('Industry, Energy and Technology'):.1f}" == '23.5' and f"{pct('Health and Community Services'):.1f}" == '2.3'
open('brand/charts/chart-estimate.svg', 'w').write(wrap(title2, b, yf + 56, 'Bars from the original estimate. Industry, Energy and Technology spent 23.5% under; Health and Community Services 2.3% over.') + '\n')
exec(open(os.path.join(os.path.dirname(__file__), 'charts_compact.py')).read())
json.dump(dict(total=total, top=top, rest_n=len(rest), rest_sum=rest_sum, pick=[(n, D[n]) for n in pick], src=SRC), open('brand/src/chart-data.json', 'w'), indent=1)
print(round(total,1), cents)
