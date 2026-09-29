"""Tests for supplier name matching, for CI (no data download needed).

1. pipeline/common.py entity_key and site/lib/mcp.mjs entityKey give the same key for every
   name in tests/fixtures/names.txt (the AI server looks suppliers up by name).
2. suppliers.match joins and keeps apart the cases below, each one a real pattern from the
   records: a join that must happen, or a false join that once happened.

  uv run python check_matching.py
"""
import json
import subprocess
import sys
from pathlib import Path

from common import entity_key, name_forms
import suppliers

ROOT = Path(__file__).resolve().parent.parent


def rec(name, dataset="fed_grant", **kw):
    return {"forms": name_forms(name, bilingual=dataset == "fed_grant"), "dataset": dataset, "amount": kw.pop("amount", 1000.0), **kw}


# (description, records, names that must share a supplier, names that must not)
CASES = [
    ("legal suffix, case and apostrophe", [rec("Bishop's Falls Inc.", "ppa"), rec("BISHOP’S FALLS LIMITED", "paradise")],
     [("Bishop's Falls Inc.", "BISHOP’S FALLS LIMITED")], []),
    ("bilingual grant name", [rec("Memorial University of Newfoundland|Université Memorial de Terre-Neuve"), rec("Université Memorial de Terre-Neuve")],
     [("Memorial University of Newfoundland", "Université Memorial de Terre-Neuve")], []),
    ("a French half that is a placeholder joins nothing", [rec("Town of Mount Carmel|N/A"), rec("Some Other Town|N/A")],
     [], [("Town of Mount Carmel", "Some Other Town")]),
    ("a bar outside federal grants is not a bilingual pair", [rec("FOX ISLAND RIVER | POINT AU MAL RECREATION COMMITTEE", "mha"), rec("Point au Mal Recreation Committee", "paradise")],
     [], [("FOX ISLAND RIVER | POINT AU MAL RECREATION COMMITTEE", "Point au Mal Recreation Committee")]),
    ("an operating name is not a join", [rec("Cavendish Hotel LP o/a Sheraton", "ppa"), rec("Sheraton", "mha")],
     [], [("Cavendish Hotel LP o/a Sheraton", "Sheraton")]),
    ("business number and a spelling slip", [rec("Frozen in Time Ltd.", bn="750936296RC0001"), rec("Frozen In Tyme Inc.", bn="750936296")],
     [("Frozen in Time Ltd.", "Frozen In Tyme Inc.")], []),
    ("an umbrella number with a charity account per congregation", [rec("Clarenville Pentecostal Tabernacle", bn="107833394RR0117"), rec("Pentecostal Tabernacle", bn="107833394RR0071")],
     [], [("Clarenville Pentecostal Tabernacle", "Pentecostal Tabernacle")]),
    ("a department placeholder is not a business number", [rec("Gary Rose", bn="000000000"), rec("Gary Ross", bn="000000000")],
     [], [("Gary Rose", "Gary Ross")]),
    ("same postal code, different initials", [rec("H & S Harvesters Limited", postal="A0G 4R0", bn="855885505RC0001"), rec("J & W Harvesters Ltd", postal="A0G 4R0")],
     [], [("H & S Harvesters Limited", "J & W Harvesters Ltd")]),
    ("same postal code and a spelling slip", [rec("Newfoundland Aqua Services Ltd.", postal="A0H 1A0"), rec("Newfoundland Aqua Service Ltd.", postal="A0H1A0")],
     [("Newfoundland Aqua Services Ltd.", "Newfoundland Aqua Service Ltd.")], []),
    ("a company and its limited partnership", [rec("Right Coast Wind Corp.", "ppa"), rec("Right Coast Wind Limited Partnership", "ppa")],
     [], [("Right Coast Wind Corp.", "Right Coast Wind Limited Partnership")]),
    ("a department printed after its government", [rec("Government of Newfoundland and Labrador"), rec("Government of Newfoundland and Labrador, Department of Education")],
     [("Government of Newfoundland and Labrador", "Government of Newfoundland and Labrador, Department of Education")], []),
    ("the province's name alone is not a body", [rec("Newfoundland and Labrador"), rec("Newfoundland and Labrador Department of Justice")],
     [], [("Newfoundland and Labrador", "Newfoundland and Labrador Department of Justice")]),
    ("the same federal award in two files", [rec("B & R ENTERPRISES LIMITED", "fed_contract", date="2023-09-07", amount=5495116.88),
                                            rec("B & R ENTERPRIES LIMITED", "canadabuys", date="2023-09-07", amount=5495116.88)],
     [("B & R ENTERPRISES LIMITED", "B & R ENTERPRIES LIMITED")], []),
    ("a '/' before a name that is not French is part of the name", [rec("Black Duck Brook/Winter Houses Recreation Committee"), rec("Black Duck Brook Development Association")],
     [], [("Black Duck Brook/Winter Houses Recreation Committee", "Black Duck Brook Development Association")]),
    ("a bracket that is not the name's acronym stays part of it", [rec("Minister of Finance (PEI)", "pa_tp"), rec("Minister of Finance (NS)", "pa_tp")],
     [], [("Minister of Finance (PEI)", "Minister of Finance (NS)")]),
    ("a charity's GST account is the same body", [rec("Town of Burin", bn="107512345RT0001"), rec("Town Council of the Town of Burin", bn="107512345RR0001")],
     [("Town of Burin", "Town Council of the Town of Burin")], []),
    ("close names with no evidence stay apart", [rec("Pittman Enterprises Ltd.", "fed_contract"), rec("Pittman's Enterprises Limited", "fed_contract")],
     [], [("Pittman Enterprises Ltd.", "Pittman's Enterprises Limited")]),
]


def check_parity() -> list[str]:
    names = [n for n in (ROOT / "tests" / "fixtures" / "names.txt").read_text().splitlines() if n.strip()]
    js = subprocess.run(["node", "--input-type=module", "-e",
                         "import { entityKey } from './site/lib/mcp.mjs';"
                         "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(JSON.parse(s).map(entityKey))));"],
                        cwd=ROOT, input=json.dumps(names), capture_output=True, text=True, check=True)
    return [f"name key differs for {n!r}: Python {entity_key(n)!r}, AI server {j!r}"
            for n, j in zip(names, json.loads(js.stdout)) if entity_key(n) != j]


def check_cases() -> list[str]:
    suppliers.RULES = ROOT / "tests" / "fixtures" / "no-rules.csv"  # the cases test the rules in code, not reviewed decisions
    problems = []
    for what, records, same, apart in CASES:
        key_of = suppliers.match(records)["key_of"]
        group = lambda n: key_of[entity_key(name_forms(n)[0])]
        problems += [f"{what}: {a!r} and {b!r} should be one supplier" for a, b in same if group(a) != group(b)]
        problems += [f"{what}: {a!r} and {b!r} should stay apart" for a, b in apart if group(a) == group(b)]
    return problems


def main() -> int:
    problems = check_parity() + check_cases()
    for p in problems:
        print("  " + p)
    print(f"FAIL: {len(problems)} matching checks" if problems else f"PASS: name keys agree; {len(CASES)} matching cases hold")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
