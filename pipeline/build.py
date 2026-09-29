"""Consolidate every clean CSV into one local SQLite database: data/build/ledger.db.

Local SQLite is the source of truth. The site build, the flags, the reconciliation
and the D1 export all read from it.

items: one row per published line (an award, a contract, a grant, a payment, a
       claim, a pay record). Every row carries its receipt: source_url, source_file
       and a human-readable locator ("page 3, row t1r12").
programs: department and program spending, planned against actual.
publishers: per-source publishing facts (broken links, discrepancies) for the
       publisher report card.
"""
import csv
import hashlib
import json
import re
import sqlite3
from collections import defaultdict

from bodies import canonical_body
import suppliers
from common import BUILD, CLEAN, entity_key, key_hash, name_forms, norm_space

DB = BUILD / "ledger.db"


def rows(name):
    p = CLEAN / name
    if not p.exists():
        return []
    with open(p, newline="") as fh:
        return list(csv.DictReader(fh))


def f(v):
    if v in (None, "", "None"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def nl_fy(date: str) -> str:
    """Provincial and federal fiscal year (April to March) for an ISO date."""
    if not date or len(date) < 7:
        return ""
    y, m = int(date[:4]), int(date[5:7])
    start = y if m >= 4 else y - 1
    return f"{start}-{str(start + 1)[2:]}"


def iid(dataset: str, *parts) -> str:
    return dataset + "-" + hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:12]


DEPT_PREFIX = re.compile(r"^(the )?(department of|dept\.? of|office of the|office of)\s+", re.I)


def buyer_name(s: str) -> str:
    s = norm_space(s).replace("&", "and")
    s = re.sub(r"\s+", " ", s)
    return s


def buyer_key(s: str) -> str:
    k = entity_key(DEPT_PREFIX.sub("", buyer_name(s)))
    return k


SCHEMA = """
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  dataset TEXT NOT NULL,
  level TEXT NOT NULL,
  buyer TEXT, buyer_key TEXT,
  supplier TEXT, supplier_key TEXT, supplier_name_key TEXT,
  person TEXT,
  description TEXT,
  amount REAL, currency TEXT, amount_original REAL,
  date TEXT, fiscal_year TEXT,
  method TEXT,
  city TEXT, province TEXT,
  extra TEXT,
  source_url TEXT, source_file TEXT, page INTEGER, locator TEXT
);
CREATE INDEX items_dataset ON items(dataset);
CREATE INDEX items_buyer ON items(buyer_key);
CREATE INDEX items_supplier ON items(supplier_key);
CREATE TABLE programs (
  fiscal_year TEXT, kind TEXT, department TEXT, department_key TEXT, account TEXT,
  program_code TEXT, program TEXT, line_type TEXT, object_code TEXT, object TEXT,
  col1 REAL, col2 REAL, col3 REAL,
  source_url TEXT, source_file TEXT, page INTEGER
);
CREATE TABLE facts (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE buyers (buyer_key TEXT PRIMARY KEY, buyer TEXT);
CREATE TABLE dept_summary (fiscal_year TEXT, department TEXT, account TEXT, gross REAL, parsed REAL, ok INTEGER,
  source_url TEXT, source_file TEXT, page INTEGER);
CREATE TABLE publisher_issues (source TEXT, listed_on TEXT, url TEXT, issue TEXT);
"""

DATASETS = {
    "ppa": ("provincial", "Provincial contract awards (Public Procurement Agency reports)"),
    "minister": ("provincial", "Ministerial expense claims"),
    "mha": ("provincial", "MHA expense reports"),
    "sunshine": ("provincial", "Public sector compensation over $100,000"),
    "fed_contract": ("federal", "Federal contracts over $10,000 with NL suppliers"),
    "fed_grant": ("federal", "Federal grants and contributions to NL recipients"),
    "canadabuys": ("federal", "CanadaBuys award notices, NL suppliers"),
    "pa_pss": ("federal", "Public Accounts: federal professional and special services paid to NL payees"),
    "pa_tp": ("federal", "Public Accounts: federal transfer payments to NL recipients"),
    "paradise": ("municipal", "Town of Paradise payment registers"),
    "stjohns": ("municipal", "City of St. John's weekly payment vouchers (sample, machine-read)"),
}


def main():
    if DB.exists():
        DB.unlink()
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    items = []

    def add(dataset, **kw):
        level = DATASETS[dataset][0]
        extra = kw.pop("extra", None)
        rec = {"dataset": dataset, "level": level, "currency": "CAD", "amount_original": None, "person": None,
               "method": None, "city": None, "province": None, "page": None, **kw}
        rec["buyer_key"] = buyer_key(rec.get("buyer") or "") if rec.get("buyer") else None
        # supplier_name_key is the printed name's own key; supplier_key is set to its group's
        # key once every record is loaded (suppliers.match).
        forms = name_forms(rec.get("supplier"), bilingual=dataset == "fed_grant")
        if forms and forms[0] != norm_space(rec["supplier"]):
            rec["supplier"] = forms[0]
            extra = {**(extra or {}), "supplier_as_printed": norm_space(kw["supplier"])}
        rec["_forms"] = forms
        if rec.get("city"):
            rec["city"] = rec["city"].replace("\u2502", "|")
        if "|" in (rec.get("city") or "") or re.search(r" [lI] ", rec.get("city") or ""):
            rec["city"] = name_forms(rec["city"], bilingual=True)[0]
        rec["supplier_name_key"] = entity_key(forms[0]) if forms else None
        rec["fiscal_year"] = rec.get("fiscal_year") or nl_fy(rec.get("date") or "")
        rec["extra"] = json.dumps({k: v for k, v in (extra or {}).items() if v not in (None, "", "None")}) if extra else None
        items.append(rec)

    # --- Provincial contract awards. A few awards are printed again in a later report
    # (same contract number, supplier and price); only the first printing is loaded and
    # the repeat is listed as a publisher issue.
    # Repeats are found after supplier matching, so a repeat printed under another spelling of
    # the supplier's name is caught too.
    for r in rows("ppa_awards.csv"):
        add("ppa", _row=r, id=iid("ppa", r["source_file"], r["page"], r["row"]),
            buyer=canonical_body(buyer_name(r["public_body"])), supplier=norm_space(r["supplier"]),
            description=r["description"], amount=f(r["amount"]), currency=r["currency"] or "CAD",
            amount_original=f(r["amount_original"]), date=r["award_date"] or r["period_end"],
            method=r["method"], city=r["city"], province=r["province"],
            extra={"public_body_as_printed": r["public_body"], "clause": r["clause"], "reason": r["reason"], "commodity": r["commodity"],
                   "contract_no": r["contract_no"], "term": r["term"], "renewal": r["renewal"],
                   "procurement_type": r["procurement_type"], "amount_text": r["amount_text"] if not f(r["amount"]) else "",
                   "report_period": f"{r['period_start']} to {r['period_end']}", "award_date_missing": 0 if r["award_date"] else 1},
            source_url=r["source_url"], source_file=r["source_file"], page=int(r["page"]),
            locator=f"page {r['page']}, award {r['award_on_page']} in the table on that page")

    # --- Ministerial expense claims
    for r in rows("minister_claims.csv"):
        name = re.sub(r"^(Honourable|Hon\.|Mr\.|Ms\.|Mrs\.|Dr\.)\s+", "", r["minister"]).strip()
        parts = [p for p in ("accommodations", "meals", "travel", "other", "hospitality") if f(r[p])]
        add("minister", id=iid("minister", r["source_file"], r["ref"], r["date"], r["line"]),
            buyer=r["department"] or "Executive Council", person=name, supplier=None,
            description=r["purpose"], amount=f(r["amount"]), date=r["date"], method=r["kind"],
            extra={"ref": r["ref"], "paid": r["paid"], "routes": r["routes"], "period": f"{r['period_start']} to {r['period_end']}",
                   **{p: f(r[p]) for p in parts}},
            source_url=r["source_url"], source_file=r["source_file"], page=int(r["page"]),
            locator=f"page {r['page']}, summary line {r['line']}" + (f"; claim detail on page {r['detail_page']}" if r.get("detail_page") and r["detail_page"] != r["page"] else ""))

    # --- MHA expense report lines
    for r in rows("mha_lines.csv"):
        add("mha", id=iid("mha", r["source_file"], r["line"]),
            buyer="House of Assembly", person=r["member"], supplier=r["vendor"] or None,
            description=r["details"], amount=f(r["amount"]), date=r["date"], fiscal_year=r["fiscal_year"],
            method=r["category"],
            extra={"district": r["district"], "doc": r["doc"]},
            source_url=r["source_url"], source_file=r["source_file"], page=int(r["page"]),
            locator=f"page {r['page']}, line {r['line']} (document {r['doc']})")

    # --- Sunshine list: people are not suppliers; employer is the buyer
    for r in rows("sunshine.csv"):
        add("sunshine", id=iid("sunshine", r["source_file"], r["sheet"], r["row"]),
            buyer=r["employer"], person=r["name"], supplier=None,
            description=r["title"], amount=f(r["total"]), date=f"{r['year']}-12-31", fiscal_year=f"calendar {r['year']}",
            method=None,
            extra={"unit": r["unit"], "base": f(r["base"]), "overtime": f(r["overtime"]), "bonus": f(r["bonus"]),
                   "shift": f(r["shift"]), "retro": f(r["retro"]), "severance": f(r["severance"]), "other": f(r["other"]),
                   "year": r["year"], "employer_as_published": r["employer_as_published"]},
            source_url=r["source_url"], source_file=r["source_file"],
            locator=f"sheet {r['sheet']}, row {r['row']}")

    # --- Federal contracts (deduplicated)
    for r in rows("fed_contracts.csv"):
        add("fed_contract", id=iid("fed_contract", r["owner_org"], r["procurement_id"] or r["reference_number"], r["vendor"].lower()),
            buyer=r["department"], supplier=r["vendor"], description=r["description"] or r["comments"],
            amount=f(r["amount"]), date=r["contract_date"],
            method="Non-competitive" if r["non_competitive"] == "1" else (r["solicitation"] or "Not stated"),
            _postal=r["postal_code"], _ref=r["reference_number"],
            extra={"original_value": f(r["original_value"]), "amendment_value": f(r["amendment_value"]),
                   "limited_reason": r["limited_reason"], "comments": r["comments"], "reference_number": r["reference_number"],
                   "procurement_id": r["procurement_id"], "versions": r["versions"], "postal_code": r["postal_code"],
                   "former_public_servant": r["former_public_servant"], "start": r["start"], "end": r["end"],
                   "standing_offer": r["standing_offer"]},
            source_url=r["source_url"], source_file="federal/contracts.csv",
            locator=f"record {r['reference_number']} (bulk file line {r['csv_line']}; latest of {r['versions']} versions)")

    # --- Federal grants (deduplicated)
    for r in rows("fed_grants.csv"):
        add("fed_grant", id=iid("fed_grant", r["owner_org"], r["agreement_number"] or r["ref_number"], r["recipient"].lower()),
            buyer=r["department"], supplier=r["recipient"], description=r["title"] or r["program"],
            amount=f(r["amount"]), date=r["start"], city=r["city"], method=r["program"],
            _bn=r.get("business_number"), _postal=r.get("postal_code"), _ref=r["ref_number"],
            extra={"program": r["program"], "riding": r["riding"], "end": r["end"], "ref_number": r["ref_number"],
                   "agreement_number": r["agreement_number"], "rows": r["rows"], "how_counted": r["how"],
                   "amendment_number": r["amendment_number"], "agreement_type": r["agreement_type"],
                   "recipient_type": r["recipient_type"], "description": r["description"][:600]},
            source_url=r["source_url"], source_file="federal/grants_NL.jsonl",
            locator=f"agreement {r['ref_number']}, amendment {r['amendment_number']}")

    for r in rows("canadabuys_nl.csv"):
        add("canadabuys", id=iid("canadabuys", r["reference_number"], r["supplier"].lower()),
            buyer=r["buyer"] or "Government of Canada", supplier=r["supplier"], description=r["title"],
            amount=f(r["amount"]), date=r["award_date"], method=r["method"], city=r["city"],
            extra={"limited_reason": r["limited_reason"], "gsin": r["gsin"], "contract_number": r["contract_number"],
                   "solicitation_number": r["solicitation_number"], "category": r["category"],
                   "note": "Amount is the total contract value after all amendments; the date is the original award date. Also reported in the federal contracts disclosure; never added to federal totals."},
            source_url=r["source_url"], source_file="federal/awardNoticeComplete.csv",
            locator=f"notice {r['reference_number']} (bulk file line {r['csv_line']})")

    for r in rows("pa_pss_nl.csv"):
        add("pa_pss", id=iid("pa_pss", r["file"], r["csv_line"]),
            buyer=r["department"], supplier=r["payee"], description=r["category"],
            amount=f(r["amount"]), date="", fiscal_year=r["fiscal_year"].replace("/20", "-"), city=r["place"],
            source_url="https://donnees-data.tpsgc-pwgsc.gc.ca/ba1/idsps-dipss/" + r["file"].replace("pss-", "idsps-dipss-"),
            source_file=f"federal/{r['file']}", locator=f"CSV line {r['csv_line']}")
    for r in rows("pa_tp_nl.csv"):
        if not r["recipient"]:
            continue
        add("pa_tp", id=iid("pa_tp", r["file"], r["csv_line"]),
            buyer=r["department"], supplier=r["recipient"], description=r["program"],
            amount=f(r["amount"]), date="", fiscal_year=r["fiscal_year"].replace("/20", "-"), city=r["city"],
            source_url="https://donnees-data.tpsgc-pwgsc.gc.ca/ba1/pt-tp/" + r["file"].replace("tp-", "pt-tp-"),
            source_file=f"federal/{r['file']}", locator=f"CSV line {r['csv_line']}")

    # --- Municipal
    for r in rows("paradise_payments.csv"):
        add("paradise", id=iid("paradise", r["source_file"], r["page"], r["payment_no"], r["invoice"], r["amount"], r["description"]),
            buyer="Town of Paradise", supplier=r["vendor"], description=r["description"],
            amount=f(r["amount"]), date=r["date"], fiscal_year=f"calendar {r['date'][:4]}",
            extra={"payment_no": r["payment_no"], "invoice": r["invoice"], "register_month": r["register_month"]},
            source_url=r["source_url"], source_file=r["source_file"], page=int(r["page"]),
            locator=f"page {r['page']}, payment {r['payment_no']}, invoice {r['invoice']}")
    for i, r in enumerate(rows("stjohns_ocr_lines.csv"), 1):
        withheld = r["payee_withheld"] == "1"
        text = r["text"]
        if withheld:
            text = re.sub(r"^.*?(?=\b[A-Z]{3,})", "", text).strip()
        add("stjohns", id=iid("stjohns", r["source_file"], r["page"], i),
            buyer="City of St. John's", supplier=None if withheld else text,
            description=text if withheld else "", amount=f(r["amount"]), date="",
            fiscal_year="calendar 2026",
            extra={"weeks": r["weeks"], "payee_withheld": int(withheld), "machine_read": 1,
                   "note": "Payee and description are one OCR text line; the City prints them side by side."},
            source_url=r["source_url"], source_file=r["source_file"], page=int(r["page"]),
            locator=f"page {r['page']} (OCR)")

    # --- Supplier matching, then provincial award repeats (same contract number, supplier and price)
    matched = suppliers.match([{"forms": it["_forms"], "dataset": it["dataset"], "amount": it["amount"], "date": it["date"],
                                "bn": it.get("_bn"), "postal": it.get("_postal"), "ref": it.get("_ref")}
                               for it in items if it["_forms"]])
    for it in items:
        it["supplier_key"] = matched["key_of"][it["supplier_name_key"]] if it["supplier_name_key"] else None
    seen_awards = {}
    ppa_repeats = []
    kept = []
    for it in items:
        r = it.get("_row")
        if r is not None:
            cno = re.sub(r"\s+", "", r["contract_no"] or "").upper()
            if cno and cno not in ("N/A", "NA", "-") and r["amount"]:
                k = (cno, it["supplier_key"], r["amount"])
                if k in seen_awards:
                    ppa_repeats.append((r, seen_awards[k]))
                    continue
                seen_awards[k] = r
        kept.append(it)
    items = kept
    matching = suppliers.write_report(matched)

    cols = ["id", "dataset", "level", "buyer", "buyer_key", "supplier", "supplier_key", "supplier_name_key", "person", "description",
            "amount", "currency", "amount_original", "date", "fiscal_year", "method", "city", "province", "extra",
            "source_url", "source_file", "page", "locator"]
    ids = set()
    dup = 0
    clean = []
    for it in items:
        if it["id"] in ids:
            dup += 1
            it["id"] = it["id"] + "-" + str(dup)
        ids.add(it["id"])
        clean.append(tuple(it.get(c) for c in cols))
    con.executemany(f"INSERT INTO items ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", clean)

    # One name per public body (its most common printing), so its page address never depends on
    # which printing a query happens to return.
    con.execute("""INSERT INTO buyers SELECT buyer_key, buyer FROM (
        SELECT buyer_key, buyer, row_number() OVER (PARTITION BY buyer_key ORDER BY count(*) DESC, buyer) r
        FROM items WHERE buyer_key IS NOT NULL GROUP BY buyer_key, buyer) WHERE r = 1""")

    # --- programs
    prog = rows("program_lines.csv")
    con.executemany(
        "INSERT INTO programs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(r["fiscal_year"], r["kind"], r["department"], entity_key(r["department"]), r["account"], r["program_code"],
          r["program"], r["line_type"], r["object_code"], r["object"], f(r["col1"]), f(r["col2"]), f(r["col3"]),
          r["source_url"], r["source_file"], int(r["page"])) for r in prog])

    con.executemany("INSERT INTO dept_summary VALUES (?,?,?,?,?,?,?,?,?)",
                    [(r["fiscal_year"], r["department"], r["account"], f(r["summary"]), f(r["parsed"]), 1 if r["ok"] == "True" else 0,
                      r["source_url"], r["source_file"], int(r["page"])) for r in rows("program_check.csv")])

    # --- publisher issues
    issues = []
    for name in ("broken_links_sunshine.csv", "broken_links_mha.csv"):
        for r in rows(name):
            issues.append((r["source"], r["listed_on"], r["url"], r["status"]))
    for r in rows("ministers_check.csv"):
        issues.append(("Ministerial expense claims", "https://www.gov.nl.ca/exec/cabinet/expenseclaims/", r["file"], r["issue"]))
    for r, first in ppa_repeats:
        issues.append(("PPA contract awards", r["source_url"], f"{r['source_file']} page {r['page']}",
                       f"award {r['contract_no']} to {r['supplier']} ({r['amount']}) printed again; first printed in {first['source_file']} page {first['page']}"))
    for r in rows("ppa_superseded.csv"):
        issues.append(("PPA contract awards", "https://www.gov.nl.ca/ppa/tenders/awarded/", r["dropped"],
                       f"replaced by a revised issue ({r['kept']})"))
    for r in rows("paradise_files.csv"):
        if "duplicate" in r["status"] or "superseded" in r["status"] or "no lines" in r["status"]:
            issues.append(("Town of Paradise payment registers", "https://www.paradise.ca/government-engage/cheque-register/",
                           r["file"], r["status"]))
    con.executemany("INSERT INTO publisher_issues VALUES (?,?,?,?)", issues)

    stats = json.loads((CLEAN / "stats.json").read_text())
    fed = json.loads((CLEAN / "federal_report.json").read_text())
    con.executemany("INSERT INTO facts VALUES (?,?)", [("stats", json.dumps(stats)), ("federal_report", json.dumps(fed)),
                                                       ("supplier_matching", json.dumps(matching)),
                                                       ("datasets", json.dumps(DATASETS))])
    con.commit()

    for ds, n, amt in con.execute("SELECT dataset, count(*), round(sum(amount)) FROM items GROUP BY dataset ORDER BY 2 DESC"):
        print(f"{ds:14} {n:7,d}  ${amt or 0:>16,.0f}")
    print("total items", con.execute("SELECT count(*) FROM items").fetchone()[0], "; duplicate ids renamed:", dup)
    print("programs", con.execute("SELECT count(*) FROM programs").fetchone()[0], "; publisher issues", len(issues))


if __name__ == "__main__":
    main()
