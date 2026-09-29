"""Municipal payment registers: Paradise (monthly cheque register PDFs) and a sample
of St. John's weekly payment vouchers (image-only PDFs, OCR in parse_municipal)."""
import re

from common import CACHE, DISABLED, fetch, get_text, load_manifest, save_manifest

PARADISE = "https://www.paradise.ca/government-engage/cheque-register/"
STJOHNS = "https://www.stjohns.ca/your-government/access-to-information-and-protection-of-privacy/proactive-disclosures/"


def paradise(m: dict) -> None:
    html = get_text(PARADISE)
    links = []
    for u in re.findall(r'href="([^"]+\.pdf)"', html, re.I):
        if u.startswith("/"):
            u = "https://www.paradise.ca" + u
        if u not in links:
            links.append(u)
    for u in links:
        # the listing page reuses some links under the wrong month; the parser dates
        # each register from its own payment dates, so the file name is just the URL slug
        slug = "-".join(u.split("/")[-2:])
        fetch(u, CACHE / "paradise" / slug, manifest=m)
    (CACHE / "paradise").mkdir(parents=True, exist_ok=True)  # a fresh cache has no folder yet
    (CACHE / "paradise" / "_links.txt").write_text("\n".join(links))
    print(f"paradise: {len(links)} unique links")


def stjohns(m: dict) -> None:
    html = get_text(STJOHNS)
    links = []
    for u in re.findall(r'href="([^"]+\.pdf)"', html, re.I):
        if u.startswith("/"):
            u = "https://www.stjohns.ca" + u
        if u not in links:
            links.append(u)
    (CACHE / "stjohns").mkdir(parents=True, exist_ok=True)  # a fresh cache has no folder yet
    (CACHE / "stjohns" / "_links.txt").write_text("\n".join(links))
    vouchers = [u for u in links if re.search(r"voucher|payment", u, re.I)]
    print(f"st. john's: {len(links)} pdf links, {len(vouchers)} look like payment vouchers")
    for u in vouchers[:6]:  # a sample: the most recent weeks listed first
        fetch(u, CACHE / "stjohns" / u.rsplit("/", 1)[1], manifest=m)


def main() -> None:
    if DISABLED >= {"paradise", "stjohns"}:
        print("municipal: skipped, both sources are switched off (common.DISABLED)")
        return
    m = load_manifest()
    if "paradise" not in DISABLED:
        paradise(m)
        save_manifest(m)
    if "stjohns" not in DISABLED:
        stjohns(m)
        save_manifest(m)


if __name__ == "__main__":
    main()
