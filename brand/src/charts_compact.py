# Phone layouts of the two charts (360 wide): the name sits above its bar, so text stays at reading size.
def wrapc(title_lines, body, h, label):
    t = ''.join(f'<text class="t" x="0" y="{22+i*22}" style="font-size:20px">{esc(l)}</text>' for i, l in enumerate(title_lines))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" class="nlchart" viewBox="0 0 360 {h}" role="img" aria-label="{esc(label)}">{STYLE}'
            f'<rect class="bg" width="360" height="{h}"/><title>{esc(label)}</title>{t}{body}</svg>')
CR = 46
# chart 1
y0 = 78; sc = 360 / top[0][1]['actual']
b = f'<text class="h" x="0" y="{y0-9}">Department</text><text class="h" x="360" y="{y0-9}" text-anchor="end">$ millions</text><line class="rule" x1="0" x2="360" y1="{y0}" y2="{y0}" stroke-width="1.5"/>'
y = y0
items = [(NAMES.get(n, n), v['actual']) for n, v in top] + [(f'{len(rest)} more departments', rest_sum)]
for i, (n, v) in enumerate(items):
    extra = 22 if i == 0 else 0
    b += f'<text class="l" x="0" y="{y+21}" style="font-size:13.5px">{esc(n)}</text><text class="n" x="360" y="{y+21}" text-anchor="end" style="font-size:13.5px">{fmt(v)}</text>{bar(0, y+29, v*sc)}'
    if i == 0:
        b += f'<line class="lead" x1="359.5" x2="359.5" y1="{y+37}" y2="{y+46}"/><text class="a" x="360" y="{y+58}" text-anchor="end">{cents}¢ of every $1</text>'
    y += CR + extra
    b += f'<line class="hair" x1="0" x2="360" y1="{y}" y2="{y}"/>'
b += f'<line class="rule" x1="0" x2="360" y1="{y+2}" y2="{y+2}" stroke-width="1.5"/><line class="rule" x1="0" x2="360" y1="{y+6}" y2="{y+6}" stroke-width="1.5"/>'
b += f'<text class="l" x="0" y="{y+28}" style="font-weight:800;font-size:13.5px">Total, current account</text><text class="n" x="360" y="{y+28}" text-anchor="end" style="font-weight:800;font-size:13.5px">{fmt(total)}</text>'
b += f'<text class="s" x="0" y="{y+54}">Source: Report on the Program Expenditures</text><text class="s" x="0" y="{y+68}">and Revenues of the Consolidated Revenue Fund,</text><text class="s" x="0" y="{y+82}">2024-25, department statements (Health, p. {top[0][1]["page"]}).</text>'
open('brand/charts/chart-share-phone.svg', 'w').write(wrapc(['Health took 45 cents of every dollar', 'of day-to-day spending in 2024-25'], b, y + 94, f'Bar chart. Health and Community Services spent ${fmt(top[0][1]["actual"])} million of ${fmt(total)} million, {cents} cents of every dollar.') + '\n')
# chart 2
zx = 254; per = 254/30; y0 = 122
b = f'<text class="h" x="0" y="{y0-9}">Department</text><text class="h" x="360" y="{y0-9}" text-anchor="end">vs estimate</text><line class="rule" x1="0" x2="360" y1="{y0}" y2="{y0}" stroke-width="1.5"/>'
b += f'<text class="h" x="{zx-5}" y="{y0-26}" text-anchor="end">Spent less</text><text class="h" x="{zx+5}" y="{y0-26}">Spent more</text>'
y = y0
for n in pick:
    v = D[n]; d = (v['actual']/v['est'] - 1)*100
    extra = 20 if n == 'Industry, Energy and Technology' else 0
    txt = f'{d:+.1f}%' if d >= 0 else f'({abs(d):.1f}%)'
    b += f'<text class="l" x="0" y="{y+21}" style="font-size:13.5px">{esc(NAMES.get(n,n))}</text><text class="n{"" if d>=0 else " neg"}" x="360" y="{y+21}" text-anchor="end" style="font-size:13.5px">{txt}</text>{bar(zx, y+29, abs(d)*per, dir=1 if d>=0 else -1)}'
    if extra:
        b += f'<text class="a" x="0" y="{y+58}">${fmt(v["actual"])}M spent of ${fmt(v["est"])}M planned</text>'
    y += CR + extra
    b += f'<line class="hair" x1="0" x2="360" y1="{y}" y2="{y}"/>'
b += f'<line class="rule" x1="{zx}" x2="{zx}" y1="{y0-4}" y2="{y}" stroke-width="1.5"/>'
b += f'<text class="s" x="0" y="{y+24}">Actual spending against the original estimate,</text><text class="s" x="0" y="{y+38}">current account. Source: Report on the Program</text><text class="s" x="0" y="{y+52}">Expenditures and Revenues of the Consolidated</text><text class="s" x="0" y="{y+66}">Revenue Fund, 2024-25.</text>'
open('brand/charts/chart-estimate-phone.svg', 'w').write(wrapc(['Industry, Energy and Technology', 'spent 23.5% under its estimate;', 'Health spent 2.3% over'], b.replace('y="','y="',1), y + 78, 'Bars from the original estimate. Industry, Energy and Technology spent 23.5% under; Health and Community Services 2.3% over.') + '\n')
