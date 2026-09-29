"""Download every PPA contract-award report PDF from 2021 to now."""
import re

from common import CACHE, fetch, get_text, load_manifest, save_manifest

PAGES = [
    "https://www.gov.nl.ca/ppa/?page_id=2673",  # January to July 2021
    "https://www.gov.nl.ca/ppa/august-2021-to-december-2021-contract-awards-and-exceptions-to-open-calls-for-bids/",
    "https://www.gov.nl.ca/ppa/2022-contract-awards/",
    "https://www.gov.nl.ca/ppa/2023-contract-awards/",
    "https://www.gov.nl.ca/ppa/2024-contract-awards/",
    "https://www.gov.nl.ca/ppa/2025-contract-awards/",
    "https://www.gov.nl.ca/ppa/tenders/awarded/",
]


def main() -> None:
    m = load_manifest()
    links: list[str] = []
    for page in PAGES:
        html = get_text(page)
        for u in re.findall(r'href="(https://www\.gov\.nl\.ca/ppa/files/[^"]+\.pdf)"', html, re.I):
            if u not in links:
                links.append(u)
    print(f"{len(links)} PPA report links")
    for u in links:
        name = u.rsplit("/", 1)[1]
        fetch(u, CACHE / "ppa" / name, manifest=m)
    save_manifest(m)
    (CACHE / "ppa").mkdir(parents=True, exist_ok=True)  # a fresh cache has no folder yet
    (CACHE / "ppa" / "_links.txt").write_text("\n".join(links))


if __name__ == "__main__":
    main()
