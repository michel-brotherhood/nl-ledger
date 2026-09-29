"""Denominators for the human-scale views, each with its source.

Statistics Canada tables are downloaded whole (WDS full-table CSV) into
data/cache/statcan; the values used are read from them here, not typed in.
Provincial income-tax brackets come from the Canada Revenue Agency's published
rates for the tax year; they are the only hand-entered figures and are cited.
"""
import csv
import json
import zipfile

from common import CACHE, CLEAN, fetch, load_manifest, save_manifest

STATCAN = {
    "14100064": "Employee wages by industry, annual",
    "17100009": "Population estimates, quarterly",
    "98100002": "Population and dwelling counts: Canada, provinces and territories (2021 Census)",
    "36100450": "Revenue, expenditure and budgetary balance, general governments",
}

# Newfoundland and Labrador personal income tax, 2025 tax year (CRA, "Provincial and
# territorial tax and credits for individuals", form NL428 rates).
NL_TAX_2025 = {
    "year": 2025,
    "brackets": [
        [0, 44192, 0.087], [44192, 88382, 0.145], [88382, 157792, 0.158], [157792, 220910, 0.178],
        [220910, 282214, 0.198], [282214, 564429, 0.208], [564429, 1128858, 0.213], [1128858, None, 0.218],
    ],
    "basic_personal_amount": 11067,
    # Low-income tax reduction, single person: form NL428 (2025) lines 95, 100 and 102
    "low_income": {"basic": 997, "threshold": 23928, "rate": 0.16},
    # Employee contributions, 2025 (CRA payroll pages). Base CPP and EI premiums are credits at the
    # lowest provincial rate (form NL428 lines 27 and 29, from federal lines 30800 and 31200); the
    # enhanced CPP and CPP2 amounts are deductions from income (federal lines 22215).
    "cpp": {"exemption": 3500, "ympe": 71300, "yampe": 81200, "base_rate": 0.0495, "enhanced_rate": 0.01, "cpp2_rate": 0.04,
            "source": "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html"},
    "ei": {"rate": 0.0164, "max_insurable": 65700,
           "source": "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html"},
    "source": "https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/last-year.html",
    "source_label": "Canada Revenue Agency, tax rates and income brackets used on the 2025 tax return, Newfoundland and Labrador; basic personal amount and low-income tax reduction from form NL428 (2025)",
}


def read_csv(table):
    path = CACHE / "statcan" / f"{table}.csv"
    if not path.exists():
        with zipfile.ZipFile(CACHE / "statcan" / f"{table}.zip") as z:
            z.extract(f"{table}.csv", CACHE / "statcan")
    with open(path, encoding="utf-8-sig", newline="") as fh:
        yield from csv.DictReader(fh)


def main():
    m = load_manifest()
    for t in STATCAN:
        fetch(f"https://www150.statcan.gc.ca/n1/tbl/csv/{t}-eng.zip", CACHE / "statcan" / f"{t}.zip", manifest=m)
    save_manifest(m)

    wage = max((r for r in read_csv("14100064")
                if r["GEO"] == "Newfoundland and Labrador" and r["Wages"] == "Median weekly wage rate"
                and r["Type of work"] == "Full-time employees" and r["Gender"] == "Total - Gender"
                and r["Age group"] == "15 years and over"
                and r["North American Industry Classification System (NAICS)"] == "Total employees, all industries"
                and r["VALUE"]), key=lambda r: r["REF_DATE"])
    pops = {r["REF_DATE"]: r for r in read_csv("17100009") if r["GEO"] == "Newfoundland and Labrador" and r["VALUE"]}
    latest_pop = pops[max(pops)]
    # Per-person figures divide the latest full fiscal year's spending (2024-25), so they use the
    # population in the middle of that year: July 1, 2024.
    pop = pops.get("2024-07-01", latest_pop)
    dw = next(r for r in read_csv("98100002") if r["GEO"] == "Newfoundland and Labrador")
    hh_col = next(k for k in dw if "Private dwellings occupied by usual residents, 2021" in k)
    gov = {}
    for r in read_csv("36100450"):
        if r["GEO"] == "Newfoundland and Labrador" and r["Levels of government"].startswith("Provincial") and r["VALUE"]:
            est = r["Estimates"]
            if est == "From households" and "From households" in gov.get(r["REF_DATE"], {}):
                continue  # the second "From households" row is under sales of goods and services
            gov.setdefault(r["REF_DATE"], {})[est] = (float(r["VALUE"]) * 1e6, r["VECTOR"])
    latest = max(gov)
    g = gov[latest]

    def sc(table):
        return f"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid={table}01"

    weekly = float(wage["VALUE"])
    out = {
        "median_weekly_wage": {"value": weekly, "year": wage["REF_DATE"], "vector": wage["VECTOR"],
                               "table": "14-10-0064-01", "url": sc("14100064"),
                               "label": "Median weekly wage, full-time employees, all industries, Newfoundland and Labrador"},
        "median_annual_wage": {"value": round(weekly * 52, 2), "year": wage["REF_DATE"],
                               "derived": "median weekly wage x 52"},
        "population": {"value": int(float(pop["VALUE"])), "date": pop["REF_DATE"], "vector": pop["VECTOR"],
                       "table": "17-10-0009-01", "url": sc("17100009"),
                       "note": "July 1 of the 2024-25 fiscal year, to match the spending year"},
        "population_latest": {"value": int(float(latest_pop["VALUE"])), "date": latest_pop["REF_DATE"]},
        "households": {"value": int(float(dw[hh_col])), "year": "2021", "table": "98-10-0002-01", "url": sc("98100002"),
                       "label": "Private dwellings occupied by usual residents, 2021 Census"},
        "provincial_government": {
            "year": latest, "table": "36-10-0450-01", "url": sc("36100450"),
            "revenue": g.get("General governments revenue", (None, None))[0],
            "expense": g.get("General governments expenditure", (None, None))[0],
            "interest_on_debt": g.get("Interest on debt", (None, None))[0],
            "personal_income_tax": g.get("From households", (None, None))[0],
            "vectors": {k: v[1] for k, v in g.items() if k in ("General governments revenue", "Interest on debt",
                                                                 "General governments expenditure", "From households")},
        },
        "nl_tax": NL_TAX_2025,
    }
    (CLEAN / "stats.json").write_text(json.dumps(out, indent=1))
    print(json.dumps({k: (v.get("value") if isinstance(v, dict) else v) for k, v in out.items() if k != "nl_tax"}, indent=1))
    print("prov gov", {k: out["provincial_government"][k] for k in ("year", "revenue", "expense", "interest_on_debt")})


if __name__ == "__main__":
    main()
