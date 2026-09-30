#!/usr/bin/env bash
# Re-run the whole data pipeline: ./run.sh (fetch, then process), ./run.sh fetch, or ./run.sh process.
# Downloads are cached in data/cache; delete a file there (or pass --refresh to a fetch script)
# to download it again. The federal bulk files are fetched again once they are 6 days old.
set -euo pipefail
cd "$(dirname "$0")"

step() { printf '\n== %s\n' "$1"; }

fetch() {
  step "fetch";    uv run python fetch_ppa.py
                   uv run python fetch_federal.py
                   uv run python fetch_provincial.py
                   uv run python fetch_municipal.py
}

process() {
  step "parse";    uv run python parse_ppa.py | tail -8
                   uv run python parse_federal.py | cut -c1-200
                   uv run python parse_sunshine.py | tail -3
                   uv run python parse_ministers.py | tail -4
                   uv run python parse_mha.py | tail -3
                   uv run python parse_programs.py | tail -18
                   uv run python parse_fiscal.py | tail -6
                   uv run python parse_municipal.py
                   uv run python stats.py | tail -2
  step "build";    uv run python build.py
  step "flags";    uv run python flags.py
  step "reconcile"; uv run python reconcile.py
  step "export";   uv run python export.py
}

case "${1:-all}" in
  fetch)   fetch ;;
  process) process ;;
  all)     fetch; process ;;
  *)       echo "usage: $0 [fetch|process]" >&2; exit 2 ;;
esac
