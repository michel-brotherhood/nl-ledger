"""Provincial sources: ministerial expense claims, MHA expense reports, sunshine list,
program expenditure reports, budget estimates and statements, and the Public Accounts.

Each listing page is scraped for its file links; files are cached under data/cache.
Link lists with their page context are saved beside the files as _index.json.
"""
import html as htmllib
import json
import re

from common import CACHE, fetch, get_text, load_manifest, save_manifest

MIN_INDEX = "https://www.gov.nl.ca/exec/cabinet/expenseclaims/"
FIRST_MIN_PERIOD = "dec20may21"  # 2021 onward


def strip_tags(s: str) -> str:
    return re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def ministers(m: dict) -> None:
    idx = get_text(MIN_INDEX)
    periods = re.findall(r'href="(https://www\.gov\.nl\.ca/exec/[^"]*(?:expense-claims|expenseclaims/)[^"]*)"', idx)
    periods = [p for p in dict.fromkeys(periods) if p.rstrip("/") != MIN_INDEX.rstrip("/")]
    keep = []
    for p in periods:
        keep.append(p)
        if FIRST_MIN_PERIOD in p:
            break
    out = []
    for p in keep:
        page = get_text(p)
        title = strip_tags(re.search(r"<title>(.*?)</title>", page, re.S).group(1)).split("|")[0].strip()
        for row in re.findall(r"<tr>(.*?)</tr>", page, re.S):
            link = re.search(r'href="(https://www\.gov\.nl\.ca/exec/files/[^"]+\.pdf)"', row)
            if not link:
                continue
            cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
            url = link.group(1)
            name = url.rsplit("/", 1)[1]
            slug = re.sub(r"[^a-z0-9]+", "-", p.rstrip("/").rsplit("/", 1)[1].lower())
            dest = CACHE / "ministers" / slug / name
            fetch(url, dest, manifest=m)
            out.append({"period_page": p, "period_title": title, "cells": cells, "url": url,
                        "file": str(dest.relative_to(CACHE))})
    (CACHE / "ministers").mkdir(parents=True, exist_ok=True)  # a fresh cache has no folder yet
    (CACHE / "ministers" / "_index.json").write_text(json.dumps(out, indent=1))
    print(f"ministers: {len(out)} reports over {len(keep)} periods")


def sunshine(m: dict) -> None:
    hub = "https://www.gov.nl.ca/exec/tbs/home/publications/compensation-disclosure/"
    page = get_text(hub)
    links = re.findall(r'href="([^"]+\.xlsx?)"', page, re.I)
    subpages = re.findall(r'href="(https://www\.gov\.nl\.ca/exec/tbs/[^"]*compensation-disclosure[^"]*)"', page)
    for sp in dict.fromkeys(subpages):
        if sp.rstrip("/") == hub.rstrip("/"):
            continue
        try:
            links += re.findall(r'href="([^"]+\.xlsx?)"', get_text(sp), re.I)
        except Exception as e:  # noqa: BLE001
            print("  skip", sp, e)
    links = list(dict.fromkeys(links))
    for u in links:
        fetch(u, CACHE / "sunshine" / u.rsplit("/", 1)[1], manifest=m)
    (CACHE / "sunshine").mkdir(parents=True, exist_ok=True)  # a fresh cache has no folder yet
    (CACHE / "sunshine" / "_links.txt").write_text("\n".join(links))
    print(f"sunshine: {len(links)} files")


MHA_BASE = "https://www.assembly.nl.ca/Members/Expenses/"
FIRST_MHA_FY = 2020  # fiscal year starting April 2020


def mhas(m: dict) -> None:
    """Annual (April to March) summary and detail reports for every member listed.

    Half-year (April to September) reports repeat lines from the annual report of the
    same fiscal year, so only the annual reports are used.
    """
    js = get_text("https://www.assembly.nl.ca/js/members-expenses.js")
    members = re.findall(r'href="\.\./Expenses/([^"]+)">([^<]+)</a>\',\s*district:\s*\'(.*)\'\s*$', js, re.M)
    out = []
    for page, name, district in members:
        html = get_text(MHA_BASE + page)
        for rel in dict.fromkeys(re.findall(r'href="(Reports/Apr(\d{4})-Mar\d{4}/[^"]+\.pdf)"', html)):
            path, fy = rel
            if int(fy) < FIRST_MHA_FY:
                continue
            url = MHA_BASE + path
            dest = CACHE / "mha" / path.split("/", 1)[1]
            fetch(url, dest, manifest=m)
            out.append({"member": htmllib.unescape(name), "district": htmllib.unescape(district.replace("\\'", "'")),
                        "page": MHA_BASE + page, "fy_start": int(fy), "kind": "detail" if "Det" in path else "summary",
                        "url": url, "file": str(dest.relative_to(CACHE)), "exists": dest.exists()})
    (CACHE / "mha").mkdir(parents=True, exist_ok=True)  # a fresh cache has no folder yet
    (CACHE / "mha" / "_index.json").write_text(json.dumps(out, indent=1))
    print(f"mha: {len(members)} members, {sum(o['exists'] for o in out)} of {len(out)} reports cached")


def main() -> None:
    m = load_manifest()
    ministers(m)
    save_manifest(m)
    sunshine(m)
    save_manifest(m)
    mhas(m)
    save_manifest(m)
    programs(m)
    save_manifest(m)


CRF_REPORTS = {  # Report on the Program Expenditures and Revenues of the CRF, by fiscal year
    "2024-25": "https://www.gov.nl.ca/exec/tbs/files/Cash-Statements-2025-with-signed-letter-Final.pdf",
    "2023-24": "https://www.gov.nl.ca/exec/tbs/files/Statement-of-Exp-and-Rev-fo-the-CRF-31-March-2024_August-26-with-signed-letter.pdf",
    "2022-23": "https://www.gov.nl.ca/exec/tbs/files/ReportOnProgramExpendituresAndRevenueOfTheConsolidatedRevenueFund2023.pdf",
    "2021-22": "https://www.gov.nl.ca/exec/tbs/files/Report-on-the-Program-Expenditures-and-Revenues-of-the-CRF-WEB.pdf",
    "2020-21": "https://www.gov.nl.ca/exec/tbs/files/The-Report-FINAL-1-1.pdf",
    "2019-20": "https://www.gov.nl.ca/exec/tbs/files/FINAL-for-the-web-The-Report-1-1.pdf",
}
ESTIMATES = {  # Estimates of the Program Expenditure and Revenue of the CRF, as tabled with each budget
    "2026-27": "https://www.gov.nl.ca/budget/2026/wp-content/uploads/sites/10/Estimates-2026.pdf",
    "2025-26": "https://www.gov.nl.ca/budget/2025/wp-content/uploads/sites/9/2025/04/Estimates-2025.pdf",
    "2024-25": "https://www.gov.nl.ca/budget/2024/wp-content/uploads/sites/8/2024/03/Estimates-2024.pdf",
    "2023-24": "https://www.gov.nl.ca/budget/2023/wp-content/uploads/sites/7/2023/03/Estimates-2023.pdf",
    "2022-23": "https://www.gov.nl.ca/budget/2022/wp-content/uploads/sites/6/2022/04/Estimates-2022.pdf",
    "2021-22": "https://www.gov.nl.ca/budget/2021/wp-content/uploads/sites/5/Estimates.pdf",
    "2020-21": "https://www.gov.nl.ca/budget/2020/wp-content/uploads/sites/3/2020/09/Estimates-2020.pdf",
    "2019-20": "https://www.gov.nl.ca/budget/2019/wp-content/uploads/sites/2/2019/04/estimates.pdf",
}
# Statements and Schedules: from Budget 2024 the budget's summary statements (cash requirements,
# consolidated statement of operations, net debt) are printed here instead of in the Estimates.
BUDGET_STATEMENTS = {
    "2026-27": "https://www.gov.nl.ca/budget/2026/wp-content/uploads/sites/10/Statements-and-Schedules-2026.pdf",
    "2025-26": "https://www.gov.nl.ca/budget/2025/wp-content/uploads/sites/9/2025/04/Statements-and-Schedules-2025.pdf",
    "2024-25": "https://www.gov.nl.ca/budget/2024/wp-content/uploads/sites/8/2024/03/Statements-and-Schedules-2024.pdf",
}
PUBLIC_ACCOUNTS = {  # Public Accounts, Consolidated Summary Financial Statements (audited), by fiscal year
    "2024-25": "https://www.gov.nl.ca/exec/tbs/files/Consolidated-Summary-Financial-Statements-March-31-2025-FINAL.pdf",
    "2023-24": "https://www.gov.nl.ca/exec/tbs/files/168496-PUB-ACC-CON-SUM-FIN-STAT-2024-web.pdf",
    "2022-23": "https://www.gov.nl.ca/exec/tbs/files/Public-Accounts-2022-23.pdf",
    "2021-22": "https://www.gov.nl.ca/exec/tbs/files/Public-Accounts-2021-22.pdf",
    "2020-21": "https://www.gov.nl.ca/exec/tbs/files/Public-Accounts-March-31-2021-1.pdf",
    "2019-20": "https://www.gov.nl.ca/exec/tbs/files/Public-Accounts-2019-20.pdf",
}


def programs(m: dict) -> None:
    for fy, url in CRF_REPORTS.items():
        fetch(url, CACHE / "crf" / f"crf-{fy}.pdf", manifest=m)
    for fy, url in ESTIMATES.items():
        fetch(url, CACHE / "estimates" / f"estimates-{fy}.pdf", manifest=m)
    for fy, url in BUDGET_STATEMENTS.items():
        fetch(url, CACHE / "budget" / f"statements-{fy}.pdf", manifest=m)
    for fy, url in PUBLIC_ACCOUNTS.items():
        fetch(url, CACHE / "public-accounts" / f"public-accounts-{fy}.pdf", manifest=m)
    print("crf, estimates, budget statements and public accounts fetched")



if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["programs"]:
        _m = load_manifest()
        programs(_m)
        save_manifest(_m)
    else:
        main()
