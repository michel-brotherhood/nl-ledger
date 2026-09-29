# NL Ledger: maintainer notes

How the live site is hosted, built, deployed and checked. The README covers what the project is and how to run it locally. The name "NL Ledger" is set in `site/lib/format.mjs` (`SITE`) and the Worker name in `site/cloudflare.config.ts`.

## Live

| What | Where |
|---|---|
| Site | https://nlledger.ca (`www.nlledger.ca` redirects to it) |
| MCP server | https://nlledger.ca/mcp |
| Worker | `nlledger` (workers.dev address turned off; the domain is the only address) |
| D1 database | `nl-ledger` (search index, 29,690 documents for 161,865 line items) |

The Cloudflare account ID and D1 database ID are not in the repository. Deploys and the D1 sync read them from `CLOUDFLARE_ACCOUNT_ID` and `NL_LEDGER_D1_ID`, in the environment or in `site/.env` (ignored by git; see `site/.env.example`). Building and checking the site locally needs neither.

## Hosting

- One Worker with static assets (Cloudflare's current replacement for Pages). Static pages are served from `site/dist` without running the Worker; only the paths in `runWorkerFirst` (`site/cloudflare.config.ts`) run `site/worker.mjs`, which sends them to the handlers in `site/routes/`.
- Deploys use the `cf` CLI (open beta) with an auth profile bound to the checkout (`cf auth activate <profile>`). A login can see more than one Cloudflare account, so `cloudflare.config.ts` names the account from `CLOUDFLARE_ACCOUNT_ID`, and `d1_sync.py` passes the same variable to every `cf d1` command.
- `cf` no longer deploys Pages projects ("Legacy Pages is not supported"), which is why the site moved off Pages.
- `www.nlledger.ca` is a proxied placeholder record (`AAAA 100::`) and a zone redirect rule (301 to `https://nlledger.ca`, path and query kept).
- The zone has Always Use HTTPS on, so `http://` requests get a 301 to `https://`.

## Layout

| Path | What |
|---|---|
| `pipeline/` | Python (uv). Fetch, parse, build, flags, reconcile, export, D1 sync |
| `data/cache/` | Downloaded source files and `manifest.json` (URL, sha256, fetch time). Not in git |
| `data/clean/` | One CSV per source after parsing. Not in git |
| `data/build/ledger.db` | Local SQLite: the source of truth for the site. Not in git |
| `site/` | Static build (`build.mjs`, `src/pages/*.mjs`), shared code (`lib/`), Worker (`worker.mjs`, `routes/`), config (`cloudflare.config.ts`, `wrangler.config.ts`) |
| `docs/reconciliation.md`, `docs/trace-sample.md` | Checks against the sources (the trace sample is drawn once and kept) |
| `docs/review-notes.md` | Second-review findings and what was done about them |

## Run the pipeline

```sh
cd pipeline
./run.sh                      # fetch (cached), parse, build, flags, reconcile, export
uv run python d1_sync.py --dry-run   # what would change in D1
uv run python d1_sync.py             # push only changed search documents
```

- Downloads are cached; delete a file under `data/cache/` to fetch it again.
- `d1_sync.py` compares document hashes and writes only what changed. An unchanged re-run writes nothing. It refuses above 90,000 writes (D1 free plan: 100,000 rows written a day). It runs each query through `cf d1 query`, so it needs the `cf` login and no token of its own. It prints the rows D1 reports written.
- Full pipeline time: about 6 minutes, most of it the MHA PDFs (read word by word with pdfplumber).

## Build and deploy the site

```sh
cd site
npm install                    # once: cf and wrangler
cf deploy                      # runs node build.mjs and ./check.sh, then uploads
cf deploy --dry-run            # build and checks only
```

- `build.mjs` takes about 5 seconds and writes `site/dist`. `check.sh` is the guardrail: backer name, author meta, accusation words.
- `cf deploy` hands the build to Wrangler (`site/wrangler.config.ts`) and writes its output under `site/.cloudflare/` (not in git).
- Local preview: `./dev.sh` from the repository root (no Cloudflare account). It serves `site/dist` and runs the Worker's route code against a local SQLite copy of the search index (`data/build/local-search.db`). With no `data/build/ledger.db` it loads the sample in `sample/`. After a full pipeline run, `cd pipeline && uv run python make_sample.py` refreshes the sample (seeded, same rows each time unless the data changes); commit `sample/`.

## How the free plan limits shaped it

| Limit | Design answer |
|---|---|
| D1: 100,000 rows written a day | 165,464 line items packed into 30,256 search documents (one per award or contract; grouped per MHA category-year, Paradise register month, pay-list job title). Diff-based sync |
| D1: 5 million rows read a day | Every filter is an indexed full-text token, no table scans. Search, supplier and record pages cached at the edge for an hour |
| Workers: 10 ms CPU | Pages are rendered from small documents; supplier pages read one of 512 JSON shards |
| Workers static assets: 20,000 files a version | 939 files: 411 static pages plus 512 shards; supplier, search, record and receipt pages are rendered on request |
| Workers: 100,000 requests a day | Only search, supplier, record, receipt and `/mcp` requests count. Static asset requests are free and unlimited |

## What is verified

- Totals against the sources' own printed totals (details in `docs/reconciliation.md`):
  - 224 minister reports: every report's lines add to its printed total.
  - 58,521 MHA lines: every category adds to its printed Period Activity; detail total equals the summary reports' total exactly.
  - Program spending: 173 of 175 department totals match the summary statements (one small 2019-20 gap; one department whose detail pages the 2024-25 report prints empty).
  - Federal contracts: $11.89B as published, $2.63B once each contract is counted once (grouped by purchase order and cleaned vendor name across departments; an earlier grouping gave $2.83B before those two corrections).
  - Federal grants: $11.68B as published, $8.67B as 29,465 agreements (latest amendment where a department reports running totals, summed where it reports changes). Method and the one disagreement with the reviewer are in `docs/review-notes.md`.
- A random sample of line items traced back to source files and pages (`docs/trace-sample.md`, results in `docs/review-notes.md`).
- A separate reviewer checked figures, wording, privacy and broken links (`docs/review-notes.md`).
- Guardrail script over the built site before each deploy.

## What is not verified

- Provincial income tax inputs: the 2025 brackets match CRA's rates page, and the basic personal amount ($11,067) matches CRA form NL428 (2025), both read in a browser because canada.ca refuses plain `curl` requests.
- CPP and EI credits on the receipt: form NL428 (2025) lines 27 and 29 take the base CPP and EI premium amounts at 8.7%; the enhanced CPP and CPP2 amounts are deductions from income. Rates and maximums are from CRA's CPP and EI pages (parameters in `pipeline/stats.py`); the method page shows a worked example at the median wage, checked by hand.
- PPA award rows have no printed totals to reconcile against; row counts per report are the check.
- Paradise registers print no totals; 71 wrapped lines in 2021-2025 registers did not parse, and registers before July 2020 use another layout and are not loaded.
- St. John's is a 12-page OCR sample only; OCR can misread characters.
- Supplier matching across sources is by normalised name only (no business numbers), so one company spelled two ways appears twice, and two different companies with the same name would merge.
- Year-over-year department comparisons do not follow renamed departments.

## D1 write budget

The NL Ledger account's first load on 2026-09-29 wrote 29,697 rows (D1's own count). The free limit is 100,000 a day per account and resets at midnight UTC. An unchanged re-run writes nothing.

## AI access (/data/ and the MCP server)

- Page: `site/src/pages/connect.mjs`; the client list, one-click links, starter questions and the home example answer are data in `site/src/connect.mjs`. Every client there is marked tested, seen or docs-only, with its doc link. Keep that true when adding one.
- Server: `site/lib/mcp.mjs`. `search_records` reads one window of 40 documents ordered by total, flattens to line items and pages them 25 at a time, so "largest" questions get the largest records. `get_members` reads `/data/members.json` (built by `site/src/mcpdata.mjs`). `search` and `fetch` follow OpenAI's deep-research shape. Four MCP prompts.
- Discovery: `/server.json` (MCP registry format, schema 2025-12-11, validates), `/mcp/server-card` and `/.well-known/ai-catalog.json` (draft SEP-2127, served by the Worker), `/llms.txt`. Nothing submitted to any registry. The registry name `ca.nlledger/nl-ledger` needs HTTP proof at `/.well-known/mcp-registry-auth` when submitting.
- Icons: `icons` on the `initialize` server info, in `server.json` and in the server card point at `/nl-ledger-icon-256.png` and `/app-icon.svg` (from `brand/svg/app-icon.svg`). ChatGPT only takes an icon when an app is created, so `/data/` offers the 256 px PNG as a download.
- Tested 2026-09-29, before the move to nlledger.ca: Claude Code (`claude mcp add --transport http nl-ledger <address>/mcp`, then `claude -p`) and Codex CLI (`codex mcp add nl-ledger --url ...`, then `codex exec`) both connected and answered with source links. Gemini CLI added the server but was not signed in, so it did not answer.
- Seen working in a browser, not documented: `https://claude.ai/customize/connectors?modal=add-custom-connector` opens the add dialog; `https://claude.ai/new?q=` and `https://chatgpt.com/?q=` open a new chat with the text typed in (not sent).
- The "Try it here" panel calls `/mcp` once per press, never on load (D1 read budget).
