"""Keep the meaning index (Cloudflare Vectorize) in step with the search documents.

Each search document (data/build/d1/docs.jsonl, from export.py) gets one vector: a short
text of what it is (source, public body, title, descriptions, methods, programs, places)
embedded with Workers AI. The site's search asks Vectorize for the documents closest in
meaning to a query and reads them from D1 by row id (site/lib/search.mjs).

Only changed documents are embedded again. What the index holds is remembered in
data/state/vectorize-<index>.json ({doc_id: hash}), written only after Cloudflare accepts
the change, so a failed run is repaired by the next one. Losing that file costs one full
re-embed (a few cents).

Needs CLOUDFLARE_API_TOKEN with Workers AI read and Vectorize edit, and CLOUDFLARE_ACCOUNT_ID
(environment or site/.env). Without a token it uses the local `cf` login (--cf-login).
Usage: uv run python vectorize_sync.py [--dry-run] [--index NAME] [--model NAME] [--limit N]
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

from common import BUILD, DATA

INDEX = "nl-ledger-meaning"
MODEL = "@cf/baai/bge-m3"
DIMS = 1024
LABEL = {
    "ppa": "Provincial contract award", "minister": "Minister's expense claim", "mha": "MHA expense",
    "sunshine": "Public sector pay over $100,000", "fed_contract": "Federal contract",
    "fed_grant": "Federal grant or contribution", "canadabuys": "Federal award notice",
    "pa_pss": "Federal professional services payment", "pa_tp": "Federal transfer payment",
}
TEXT_MAX = 1200  # characters; about 300 tokens, keeps weekly cost and query noise down


def setting(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    env_file = Path(__file__).parent.parent / "site" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip() == name:
                return value.strip()
    return ""


def embed_text(d: dict) -> str:
    """What a reader would say the document is about, most telling parts first."""
    body = json.loads(d["items"])
    its = body["it"]
    parts = [LABEL.get(d["dataset"], d["dataset"]), d["buyer"] or "", d["title"] or ""]
    seen = set(p.lower() for p in parts)
    for get in (lambda it: it.get("d"), lambda it: (it.get("x") or {}).get("program"), lambda it: it.get("m"),
                lambda it: it.get("s"), lambda it: it.get("city") and f"in {it['city']}"):
        for it in its:
            v = get(it)
            if v and v.lower() not in seen:
                seen.add(v.lower())
                parts.append(v)
    text = ". ".join(p.strip() for p in parts if p and p.strip())
    return text[:TEXT_MAX]


def years(d: dict) -> tuple[int, int]:
    """First and last year of the document, as the zy tags count them (export.py)."""
    ys = []
    for it in json.loads(d["items"])["it"]:
        y = (it.get("t") or "")[:4] or (it.get("fy") or "")[-4:]
        if len(y) == 4 and y.isdigit():
            ys.append(int(y))
        elif (it.get("fy") or "")[-2:].isdigit() and "-" in (it.get("fy") or ""):
            ys.append(2000 + int(it["fy"][-2:]))  # "2021-22"
    return (min(ys), max(ys)) if ys else (0, 0)


class Cloudflare:
    def __init__(self, account: str, token: str):
        self.base = f"https://api.cloudflare.com/client/v4/accounts/{account}"
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {token}"

    def call(self, method: str, path: str, **kw):
        for attempt in range(5):
            r = self.s.request(method, self.base + path, timeout=120, **kw)
            if r.status_code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(3 * (attempt + 1))
                continue
            break
        try:
            j = r.json()
        except ValueError:
            raise RuntimeError(f"{method} {path}: HTTP {r.status_code} {r.text[:300]}")
        if not j.get("success"):
            raise RuntimeError(f"{method} {path}: HTTP {r.status_code} {j.get('errors')}")
        return j["result"]

    def embed(self, model: str, texts: list[str]) -> list[list[float]]:
        return self.call("POST", f"/ai/run/{model}", json={"text": texts})["data"]

    def index_info(self, name: str):
        try:
            return self.call("GET", f"/vectorize/v2/indexes/{name}")
        except RuntimeError as e:
            if "404" in str(e) or "not_found" in str(e).lower() or "3000" in str(e):
                return None
            raise

    def create_index(self, name: str, dims: int):
        self.call("POST", "/vectorize/v2/indexes", json={
            "name": name, "description": "NL Ledger search documents by meaning (pipeline/vectorize_sync.py)",
            "config": {"dimensions": dims, "metric": "cosine"}})
        # Metadata indexes must exist before vectors are inserted, or those vectors are not filterable.
        for prop, typ in (("ds", "string"), ("y0", "number"), ("y1", "number")):
            self.call("POST", f"/vectorize/v2/indexes/{name}/metadata_index/create",
                      json={"propertyName": prop, "indexType": typ})

    def upsert(self, name: str, vectors: list[dict]):
        body = "\n".join(json.dumps(v, separators=(",", ":")) for v in vectors)
        return self.call("POST", f"/vectorize/v2/indexes/{name}/upsert", data=body.encode(),
                         headers={"Content-Type": "application/x-ndjson"})

    def delete(self, name: str, ids: list[str]):
        return self.call("POST", f"/vectorize/v2/indexes/{name}/delete_by_ids", json={"ids": ids})


def cf_login_token() -> str:
    """The local `cf` login's OAuth token (for runs on a maintainer's machine). The token lasts an
    hour; any `cf` command renews it, so one is run first."""
    import subprocess
    subprocess.run(["cf", "auth", "whoami"], capture_output=True, cwd=Path(__file__).parent)
    cfg = Path.home() / "Library/Preferences/cloudflare/config"
    if not cfg.exists():
        cfg = Path.home() / ".config/cloudflare/config"
    for f in sorted(cfg.glob("*.json")):
        tok = json.loads(f.read_text()).get("oauth_token")
        if tok:
            return tok
    sys.exit("No CLOUDFLARE_API_TOKEN and no cf login found")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--index", default=INDEX)
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--dims", type=int, default=DIMS)
    ap.add_argument("--limit", type=int, help="only the first N documents (for a trial)")
    ap.add_argument("--cf-login", action="store_true", help="use the local cf login instead of CLOUDFLARE_API_TOKEN")
    ap.add_argument("--max-docs", type=int, default=60_000, help="refuse to embed more than this many in one run")
    a = ap.parse_args()

    account = setting("CLOUDFLARE_ACCOUNT_ID")
    if not account:
        sys.exit("CLOUDFLARE_ACCOUNT_ID is not set")
    token = cf_login_token() if a.cf_login or not setting("CLOUDFLARE_API_TOKEN") else setting("CLOUDFLARE_API_TOKEN")
    cf = Cloudflare(account, token)

    docs = []
    with open(BUILD / "d1" / "docs.jsonl") as fh:
        for line in fh:
            docs.append(json.loads(line))
            if a.limit and len(docs) >= a.limit:
                break
    state_file = DATA / "state" / f"vectorize-{a.index}.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else {}
    local = {d["doc_id"]: d for d in docs}
    changed = [d for d in docs if state.get(d["doc_id"]) != d["h"]]
    gone = [k for k in state if k not in local] if not a.limit else []
    print(f"{a.index}: holds {len(state):,}, local {len(local):,}; embed {len(changed):,}, delete {len(gone):,}")
    if len(changed) > a.max_docs:
        sys.exit(f"Refusing: {len(changed):,} documents to embed is over --max-docs {a.max_docs:,}")
    if a.dry_run:
        # Also proves the token can reach both services, so a missing permission fails before deploy.
        for what, test in (("Workers AI read", lambda: cf.embed(a.model, ["permission check"])),
                           ("Vectorize edit", lambda: cf.index_info(a.index))):
            try:
                test()
            except RuntimeError as e:
                if "401" in str(e) or "403" in str(e):
                    sys.exit(f"The Cloudflare token is refused by {what.split()[0]} {what.split()[1]}: add the "
                             f"'{what}' permission to it (NOTES.md, Weekly job). {e}")
                raise
        print(f"token can run {a.model} and reach Vectorize; index {a.index} {'exists' if cf.index_info(a.index) else 'will be created'}")
        return

    if not cf.index_info(a.index):
        print(f"creating index {a.index} ({a.dims} dimensions, cosine)")
        cf.create_index(a.index, a.dims)

    def save():
        state_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, separators=(",", ":")))
        tmp.replace(state_file)

    for i in range(0, len(gone), 500):
        cf.delete(a.index, gone[i:i + 500])
        for k in gone[i:i + 500]:
            state.pop(k, None)
        save()
    t0, n = time.time(), 0
    for i in range(0, len(changed), 100):
        part = changed[i:i + 100]
        vecs = cf.embed(a.model, [embed_text(d) for d in part])
        rows = []
        for d, v in zip(part, vecs):
            y0, y1 = years(d)
            rows.append({"id": d["doc_id"], "values": [round(x, 6) for x in v],
                         "metadata": {"ds": d["dataset"], "y0": y0, "y1": y1, "h": d["h"]}})
        cf.upsert(a.index, rows)
        for d in part:
            state[d["doc_id"]] = d["h"]
        n += len(part)
        if n % 2000 == 0 or n == len(changed):
            save()
            print(f"  {n:,}/{len(changed):,} embedded ({time.time() - t0:.0f}s)", flush=True)
    save()
    print(f"done: {a.index} now holds {len(state):,} documents; embedded {n:,}, deleted {len(gone):,}")


if __name__ == "__main__":
    main()
