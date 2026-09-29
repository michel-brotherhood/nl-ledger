"""Provincial sources: ministerial expense claims, MHA expense reports, sunshine list,
program expenditure reports and budget estimates.

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
ESTIMATES = {
    "2026-27": "https://www.gov.nl.ca/budget/2026/wp-content/uploads/sites/10/Estimates-2026.pdf",
}


def programs(m: dict) -> None:
    for fy, url in CRF_REPORTS.items():
        fetch(url, CACHE / "crf" / f"crf-{fy}.pdf", manifest=m)
    for fy, url in ESTIMATES.items():
        fetch(url, CACHE / "estimates" / f"estimates-{fy}.pdf", manifest=m)
    print("crf and estimates fetched")



if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["programs"]:
        _m = load_manifest()
        programs(_m)
        save_manifest(_m)
    else:
        main()
