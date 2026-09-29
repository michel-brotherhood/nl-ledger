#!/usr/bin/env bash
# Re-run the whole data pipeline. Downloads are cached in data/cache; delete a file
# there (or pass --refresh to a fetch script) to download it again.
set -euo pipefail
cd "$(dirname "$0")"

step() { printf '\n== %s\n' "$1"; }

step "fetch";      uv run python fetch_ppa.py
                   uv run python fetch_federal.py
                   uv run python fetch_provincial.py
                   uv run python fetch_municipal.py
step "parse";      uv run python parse_ppa.py | tail -8
                   uv run python parse_federal.py | cut -c1-200
                   uv run python parse_sunshine.py | tail -3
                   uv run python parse_ministers.py | tail -4
                   uv run python parse_mha.py | tail -3
                   uv run python parse_programs.py | tail -12
                   uv run python parse_municipal.py
                   uv run python stats.py | tail -2
step "build";      uv run python build.py
step "flags";      uv run python flags.py
step "reconcile";  uv run python reconcile.py
step "export";     uv run python export.py
