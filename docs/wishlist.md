# Wishlist

Public records that are known to exist and are not yet in NL Ledger. Each has a GitHub issue labelled [wishlist](https://github.com/steveclarke/nl-ledger/labels/wishlist), where the work is discussed; comment there to pick one up. Sources already loaded are in the README.

## Provincial contracts

| Source | Why it matters | Where it lives | Status |
|---|---|---|---|
| MERX award results ([#1](https://github.com/steveclarke/nl-ledger/issues/1)) | Open-call awards by departments appear on MERX, not in the Public Procurement Agency reports, so the largest competed contracts are missing from the site. | <https://www.merx.com/govnl/solicitations/awarded-bids?selectedContent=BUYER> (4,381 awarded solicitations listed) | The listing loads. Whether award values and winners are shown, and the terms of use for scraping, are untested. |
| Pre-2021 federal contracts file ([#2](https://github.com/steveclarke/nl-ledger/issues/2)) | Federal contract disclosure before the years loaded would extend the federal record back in time. | <https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b> and the earlier contract files on open.canada.ca | Older files use other layouts and need their own reader. |

## Municipal payments

| Source | Why it matters | Where it lives | Status |
|---|---|---|---|
| Other municipalities' payment registers ([#3](https://github.com/steveclarke/nl-ledger/issues/3)) | Only Paradise (full) and St. John's (sample) are loaded. Most towns publish nothing line by line, so any that do are worth adding. | Town budget and council pages: Mount Pearl, Conception Bay South, Gander, Corner Brook, Grand Falls-Windsor and others | A bounded search found no payment registers for the five named. Contributions of any register found are welcome. |
| St. John's payment vouchers, full file ([#4](https://github.com/steveclarke/nl-ledger/issues/4)) | The site loads a 12-page sample. The full weekly files hold every accounts-payable payment. | <https://www.stjohns.ca/your-government/access-to-information-and-protection-of-privacy/proactive-disclosures/> | Scanned images; about 1,300 pages to read by OCR. |

## Public bodies

| Source | Why it matters | Where it lives | Status |
|---|---|---|---|
| NL Health Services ([#5](https://github.com/steveclarke/nl-ledger/issues/5)) | The largest public employer and purchaser in the province. Its pay lists are in the compensation disclosure; its spending detail is not loaded. | <https://www.gov.nl.ca/exec/tbs/home/publications/compensation-disclosure/> for pay; procurement and financial reports on the NL Health Services site | Scope of what is published line by line is unchecked. |
| Memorial University ([#6](https://github.com/steveclarke/nl-ledger/issues/6)) | A large public body with its own pay list and purchasing. | Compensation disclosure hub above; university financial reports | Scope unchecked. |

## Influence and money in politics

| Source | Why it matters | Where it lives | Status |
|---|---|---|---|
| Lobbyist registry ([#7](https://github.com/steveclarke/nl-ledger/issues/7)) | Shows who lobbied about which contracts and grants, and can be set beside the awards. | <https://cado.eservices.gov.nl.ca/Lobbyist/LobbyistSearch.aspx> | Search form only; no bulk download found. |
| Elections NL contributions ([#8](https://github.com/steveclarke/nl-ledger/issues/8)) | Donor, party and amount, to set beside supplier names. | <https://www.elections.gov.nl.ca/resources/areports/> | PDFs 2017 to 2025; Excel files for 2016 to 2022 without dates. |
