"""Export the search index for Cloudflare D1.

D1 on the free plan allows 100,000 rows written per day, so the line items (about 162,000)
are packed into search documents: one document per award or contract, and for the
large line-level sources a document per natural group (an MHA member's allowance
category for a year, a Paradise register month, an employer's job title for a
year). Each document carries its items as JSON; the site and the MCP server filter
items inside a matched document.

Every filter is a token in the indexed `tags` column (dataset, level, buyer,
supplier, year, flag, item id), so D1 answers filters from the full-text index
instead of scanning rows.

Output: data/build/d1/schema.sql, data/build/d1/docs.jsonl (for d1_sync.py),
data/build/d1/full.sql (a complete load, used for local testing).
"""
import hashlib
import json
import sqlite3
from collections import defaultdict

from build import DB
from common import BUILD, key_hash

OUT = BUILD / "d1"
SCHEMA = """CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
  body, tags,
  doc_id UNINDEXED, dataset UNINDEXED, title UNINDEXED, buyer UNINDEXED, total UNINDEXED, n UNINDEXED,
  date_min UNINDEXED, date_max UNINDEXED, h UNINDEXED, items UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2', columnsize = 0
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
"""

CHUNK = {  # dataset -> (group key fields, max items per document)
    "ppa": (None, 1), "fed_contract": (None, 1), "canadabuys": (None, 1), "pa_pss": (None, 1),
    "fed_grant": (("buyer", "method", "fiscal_year"), 25),
    "pa_tp": (("buyer", "description", "fiscal_year"), 25),
    "sunshine": (("buyer", "fiscal_year", "description"), 30),
    "minister": (("person", "fiscal_year"), 30),
    "mha": (("person", "fiscal_year", "method"), 30),
    "paradise": (("extra_month",), 30),
    "stjohns": (("page",), 40),
}


def tok(prefix: str, value: str) -> str:
    return prefix + key_hash(value or "", 10)


def clip(s, n):
    s = s or ""
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def short(item_id: str) -> str:
    return item_id.rsplit("-", 1)[-1]


def compact(it: dict, flags: list[str], doc_buyer: str, doc_url: str | None) -> dict:
    x = json.loads(it["extra"] or "{}")
    keep = {k: x[k] for k in ("original_value", "limited_reason", "clause", "contract_no", "program", "riding", "district",
                              "routes", "unit", "base", "overtime", "bonus", "shift", "retro", "severance", "other", "invoice", "payment_no",
                              "weeks", "payee_withheld", "machine_read", "report_period", "term", "reason", "amount_text",
                              "ref_number", "reference_number", "period", "accommodations", "meals", "travel", "other",
                              "note") if k in x and x[k] not in (None, "", 0)}
    d = {"i": short(it["id"]), "s": it["supplier"], "k": key_hash(it["supplier_key"], 10) if it["supplier_key"] else None,
         "p": it["person"], "b": it["buyer"] if it["buyer"] != doc_buyer else None, "d": clip(it["description"], 320),
         "a": it["amount"], "c": it["currency"] if it["currency"] != "CAD" else None, "o": it["amount_original"],
         "t": it["date"], "fy": it["fiscal_year"] if not it["date"] else None, "m": it["method"], "city": it["city"],
         "u": it["source_url"] if it["source_url"] != doc_url else None, "g": it["page"],
         "l": it["locator"], "f": flags or None, "x": keep or None}
    return {k: v for k, v in d.items() if v not in (None, "", [])}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    item_flags = defaultdict(list)
    for fid, iid in con.execute("SELECT flag, item_id FROM flags WHERE item_id IS NOT NULL"):
        item_flags[iid].append(fid)
    groups = defaultdict(list)
    for it in con.execute("SELECT * FROM items ORDER BY dataset, buyer, supplier, date"):
        it = dict(it)
        keys, cap = CHUNK[it["dataset"]]
        if keys is None:
            gk = (it["dataset"], it["id"])
        else:
            vals = []
            for k in keys:
                if k == "extra_month":
                    vals.append((it["date"] or "")[:7])
                else:
                    vals.append(it.get(k) or "")
            gk = (it["dataset"], *vals)
        groups[gk].append(it)

    docs = []
    for gk, its in groups.items():
        cap = CHUNK[gk[0]][1]
        for start in range(0, len(its), cap):
            part = its[start:start + cap]
            ds = gk[0]
            doc_id = f"{ds}:" + hashlib.sha1("|".join(map(str, gk)).encode()).hexdigest()[:12] + (f":{start // cap}" if len(its) > cap else "")
            rowid = int(hashlib.sha1(doc_id.encode()).hexdigest()[:15], 16)
            urls = {i["source_url"] for i in part}
            doc_url = part[0]["source_url"] if len(urls) == 1 else None
            items = [compact(i, item_flags.get(i["id"], []), part[0]["buyer"], doc_url) for i in part]
            body = " ".join(filter(None, [part[0]["buyer"]] + [
                " ".join(filter(None, [i["supplier"], i["person"], i["description"], i["method"], i["city"],
                                       (json.loads(i["extra"] or "{}").get("program") or "")]))
                for i in part]))
            tags = {f"zds{ds.replace('_', '')}", f"zlv{part[0]['level'][:4]}"}
            for i in part:
                if i["buyer_key"]:
                    tags.add(tok("zb", i["buyer_key"]))
                if i["supplier_key"]:
                    tags.add(tok("zs", i["supplier_key"]))
                if i["person"]:
                    tags.add(tok("zp", i["person"].lower()))
                y = (i["date"] or "")[:4] or (i["fiscal_year"] or "")[-4:]
                if y.isdigit():
                    tags.add(f"zy{y}")
                tags.add("zi" + short(i["id"]))
                for fl in item_flags.get(i["id"], []):
                    tags.add("zf" + fl.replace("-", ""))
            dates = [i["date"] for i in part if i["date"]]
            if len(part) == 1:
                p = part[0]
                title = p["supplier"] or p["person"] or p["description"] or ""
            elif ds == "mha":
                title = f"{part[0]['person']}: {part[0]['method']}, {part[0]['fiscal_year']}"
            elif ds == "minister":
                title = f"{part[0]['person']}: claims paid {part[0]['fiscal_year']}"
            elif ds == "sunshine":
                title = f"{part[0]['buyer']}: {part[0]['description']}, {part[0]['fiscal_year'].replace('calendar ', '')}"
            elif ds == "paradise":
                title = f"Town of Paradise payments, {gk[1]}"
            elif ds == "stjohns":
                title = f"City of St. John's vouchers, page {gk[1]}"
            else:
                title = f"{part[0]['buyer']}: {part[0]['method'] or part[0]['description']}, {part[0]['fiscal_year']}"
            items_json = json.dumps({"ds": ds, "lv": part[0]["level"], "u": doc_url, "it": items},
                                    separators=(",", ":"), ensure_ascii=False)
            total = round(sum(i["amount"] or 0 for i in part), 2)
            rec = {"rowid": rowid, "body": body, "tags": " ".join(sorted(tags)), "doc_id": doc_id, "dataset": ds,
                   "title": title, "buyer": part[0]["buyer"], "total": total, "n": len(part),
                   "date_min": min(dates) if dates else "", "date_max": max(dates) if dates else "", "items": items_json}
            rec["h"] = hashlib.sha1(json.dumps(rec, sort_keys=True).encode()).hexdigest()[:16]
            docs.append(rec)

    with open(OUT / "docs.jsonl", "w") as fh:
        for d in docs:
            fh.write(json.dumps(d, ensure_ascii=False) + "\n")
    (OUT / "schema.sql").write_text(SCHEMA)
    cols = ["rowid", "body", "tags", "doc_id", "dataset", "title", "buyer", "total", "n", "date_min", "date_max", "h", "items"]
    with open(OUT / "full.sql", "w") as fh:
        fh.write(SCHEMA)
        fh.write("DELETE FROM docs;\n")
        for d in docs:
            fh.write(insert_sql(d, cols))
    per = defaultdict(int)
    for d in docs:
        per[d["dataset"]] += 1
    sizes = sorted(len(d["items"]) for d in docs)
    print(f"{len(docs):,} documents for {sum(d['n'] for d in docs):,} items; largest items JSON {sizes[-1]:,} bytes; "
          f"median {sizes[len(sizes) // 2]:,}")
    print(dict(per))


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def insert_sql(d, cols):
    return f"INSERT INTO docs({','.join(cols)}) VALUES ({','.join(q(d[c]) for c in cols)});\n"


if __name__ == "__main__":
    main()
