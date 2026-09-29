# Brand

The NL Ledger mark is the stacked wordmark: NL over LEDGER, set in Archivo (weight 900, width 64) and outlined to paths. The favicon is the stacked mark at every size; NL-alone icons are kept for places too small for the stack. Colours and type come from [`DESIGN.md`](../DESIGN.md). The full guide, with every asset and the contrast checks, is [`index.html`](index.html); open it in a browser.

## Files

| Folder | What |
|---|---|
| `svg/` | Wordmark (one line and stacked), icons and app icons in colour, black and white |
| `png/` | The same at export sizes |
| `favicon/` | Favicons, app icons and the web manifest used by the site |
| `social/` | Share image (`og.png`) and the GitHub social preview |
| `charts/` | Chart style samples, desktop and phone |
| `screens/` | The icons checked in a browser tab and on phone home screens |
| `fonts/` | Archivo, with its licence notes |
| `src/` | The scripts that make all of the above |

## Regenerate

Run from the repository root. It needs Python with `fonttools`, Node with Playwright (`npm install --no-save playwright && npx playwright install chromium`), and a built site (`data/build/ledger.db` from the pipeline, then `node site/build.mjs`) for the charts and share images.

```sh
python brand/src/wordmark.py 64
python brand/src/make_svgs.py
python brand/src/charts.py
python brand/src/social.py
python brand/src/guide.py
```

PNG and ICO exports use Inkscape and ImageMagick.
