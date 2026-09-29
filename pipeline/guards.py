"""Checks that stop the weekly job before a bad or stale build reaches the site.

  uv run python guards.py check    after the pipeline, before deploying
  uv run python guards.py commit   after a successful deploy and D1 sync: this run becomes the baseline

`check` fails (exit 1, one line per problem) when:
- nothing was fetched in the last 8 days (the federal files are refetched weekly, so the
  newest fetch date is this run's; an older one means the fetch silently did nothing);
- a download failed that did not fail in the last good run (a source moved or is down);
  downloads that were already failing (reports listed but never published) are reported only;
- a dataset lost items, or the cache lost files, against the last good run (a changed PDF
  layout or listing page parses to fewer rows).

After a person has looked at a failure and found it real and expected (a report withdrawn,
a link the publisher broke for good), NL_LEDGER_ACCEPT_CHANGES=1 turns these into notes for
one run, and that run's state becomes the new baseline.

The baseline is data/state/last_good.json. With no baseline (the first run) the counts are
recorded, not compared.
"""
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

from common import BUILD, CACHE, DISABLED, FAILURES, ROOT, load_manifest

STATE = ROOT / "data" / "state"
BASELINE = STATE / "last_good.json"
MAX_FETCH_AGE_DAYS = 8
ALLOWED_DROP = 0.02  # a dataset may shrink by 2% (superseded reports, de-duplication) before it fails


def snapshot() -> dict:
    con = sqlite3.connect(BUILD / "ledger.db")
    counts = {ds: n for ds, n in con.execute("SELECT dataset, count(*) FROM items GROUP BY dataset")}
    manifest = load_manifest()
    gathered = max((e.get("fetched_at", "") for e in manifest.values()), default="")
    failures = json.loads(FAILURES.read_text()) if FAILURES.exists() else []
    return {"counts": counts, "files": len(manifest), "gathered": gathered,
            "failures": sorted({f["url"] for f in failures}), "failure_detail": failures}


def check() -> None:
    now = snapshot()
    base = json.loads(BASELINE.read_text()) if BASELINE.exists() else None
    problems, notes = [], []

    if not now["gathered"]:
        problems.append("manifest.json has no fetch dates")
    else:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(now["gathered"])
        if age.days >= MAX_FETCH_AGE_DAYS:
            problems.append(f"stale: newest download is {now['gathered'][:10]}, {age.days} days old; nothing was fetched this run")

    known = set(base["failures"]) if base else set()
    accept = os.environ.get("NL_LEDGER_ACCEPT_CHANGES") == "1"
    for f in now["failure_detail"]:
        line = f"{f['reason']}: {f['url']}" + (" (older copy kept)" if f["cached_copy"] else "")
        if f["url"] in known:
            notes.append("still failing, " + line)
        elif base is None and f["reason"].startswith(("404", "HTML")):
            notes.append("not published, " + line)  # first run: listed-but-missing reports become the baseline
        else:
            (notes if accept else problems).append("download failed, " + line)

    if base:
        for ds, was in base["counts"].items():
            if ds in DISABLED:  # switched off on purpose (common.DISABLED)
                continue
            n = now["counts"].get(ds, 0)
            if n < was * (1 - ALLOWED_DROP):
                (notes if accept else problems).append(f"{ds}: {n:,} items, down from {was:,} in the last good run")
        if now["files"] < base["files"]:
            (notes if accept else problems).append(f"cache: {now['files']} files in manifest.json, down from {base['files']}")

    for n in notes:
        print("note:", n)
    for p in problems:
        print("FAIL:", p)
    total = sum(now["counts"].values())
    change = f", {total - sum(base['counts'].values()):+,} since last good run" if base else " (first run, no baseline)"
    print(f"guards: {total:,} items in {len(now['counts'])} datasets{change}; {now['files']} source files; newest download {now['gathered'][:10]}")
    if problems:
        sys.exit(1)


def commit() -> None:
    now = snapshot()
    now.pop("failure_detail")
    now["committed_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    STATE.mkdir(parents=True, exist_ok=True)
    tmp = BASELINE.with_suffix(".part")
    tmp.write_text(json.dumps(now, indent=1, sort_keys=True))
    tmp.rename(BASELINE)
    print(f"guards: baseline saved ({sum(now['counts'].values()):,} items)")


if __name__ == "__main__":
    {"check": check, "commit": commit}[sys.argv[1] if len(sys.argv) > 1 else "check"]()
