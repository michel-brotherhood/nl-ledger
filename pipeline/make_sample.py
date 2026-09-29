"""Write the sample data that lets a fresh clone run the site without the pipeline.

Maintainers run this after a full pipeline run (`./run.sh`); contributors never need to.
It keeps a random sample of the line items (the same rows every time, seeded), everything
else in the database as is, and writes:

  sample/ledger.sql.gz    the sample database, as SQL text
  sample/docs.jsonl.gz    the search documents for those items (the same export the site's D1 index uses)
  sample/schema.sql, sample/manifest.json, sample/flag_catalog.json

`site/dev.mjs` (`./dev.sh`) loads these into data/build/ when there is no real database.
"""
import gzip
import json
import random
import shutil
import sqlite3
import tempfile
from pathlib import Path

import export
from common import BUILD, CACHE

SAMPLE = Path(__file__).resolve().parent.parent / "sample"
# How many line items to keep per dataset. Flagged items are kept first so every flag page has examples.
KEEP = {"ppa": 700, "fed_contract": 500, "canadabuys": 80, "pa_pss": 100, "pa_tp": 200, "fed_grant": 500, "mha": 1800,
        "minister": 500, "paradise": 500, "stjohns": 100, "sunshine": 900}
SEED = 20260929


def main():
    SAMPLE.mkdir(exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    db = tmp / "ledger.db"
    shutil.copy(BUILD / "ledger.db", db)
    con = sqlite3.connect(db)
    rng = random.Random(SEED)
    flagged = {r[0] for r in con.execute("SELECT DISTINCT item_id FROM flags WHERE item_id IS NOT NULL")}
    keep = set()
    for ds, n in KEEP.items():
        ids = sorted(r[0] for r in con.execute("SELECT id FROM items WHERE dataset=?", (ds,)))
        first = [i for i in ids if i in flagged]
        rest = [i for i in ids if i not in flagged]
        rng.shuffle(first)
        rng.shuffle(rest)
        keep.update((first[: n // 2] + rest)[:n])
    # Every public body a pattern names keeps its largest record, so its page exists and no link from a pattern page is broken.
    for (key,) in con.execute("SELECT DISTINCT subject_key FROM flags WHERE subject_type='buyer'").fetchall():
        row = con.execute("SELECT id FROM items WHERE buyer_key=? AND dataset IN ('ppa','fed_contract','fed_grant','canadabuys','paradise','stjohns') ORDER BY amount DESC LIMIT 1", (key,)).fetchone()
        if row:
            keep.add(row[0])
    # A few suppliers that combine several printed names keep every record, so a supplier page shows its names.
    for (key,) in con.execute("SELECT supplier_key FROM items WHERE supplier_key IS NOT NULL GROUP BY supplier_key "
                              "HAVING count(DISTINCT supplier_name_key) > 1 AND count(*) <= 60 ORDER BY sum(amount) DESC LIMIT 3").fetchall():
        keep.update(r[0] for r in con.execute("SELECT id FROM items WHERE supplier_key=?", (key,)))
    con.execute("CREATE TEMP TABLE keep(id TEXT PRIMARY KEY)")
    con.executemany("INSERT INTO keep VALUES (?)", [(i,) for i in keep])
    con.execute("DELETE FROM items WHERE id NOT IN (SELECT id FROM keep)")
    con.execute("DELETE FROM flags WHERE item_id IS NOT NULL AND item_id NOT IN (SELECT id FROM keep)")
    con.execute("INSERT OR REPLACE INTO facts VALUES ('sample', '1')")
    con.commit()
    con.execute("VACUUM")
    with gzip.open(SAMPLE / "ledger.sql.gz", "wt", encoding="utf-8", compresslevel=9) as fh:
        for line in con.iterdump():
            fh.write(line + "\n")
    con.close()

    # The search documents come from the same export the real index uses, run over the sample database.
    export.DB = db
    export.OUT = tmp / "d1"
    export.main()
    with open(export.OUT / "docs.jsonl", "rb") as src, gzip.open(SAMPLE / "docs.jsonl.gz", "wb", compresslevel=9) as dst:
        shutil.copyfileobj(src, dst)
    # The site only reads the newest fetch date from the download manifest.
    manifest = json.loads((CACHE / "manifest.json").read_text())
    newest = max(m.get("fetched_at", "") for m in manifest.values())
    (SAMPLE / "manifest.json").write_text(json.dumps({"sample": {"fetched_at": newest}}) + "\n")
    shutil.copy(export.OUT / "schema.sql", SAMPLE / "schema.sql")
    shutil.copy(BUILD / "flag_catalog.json", SAMPLE / "flag_catalog.json")
    shutil.rmtree(tmp)
    for f in sorted(SAMPLE.iterdir()):
        print(f"{f.name}: {f.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
