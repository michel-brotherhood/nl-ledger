# Reconciliation

Generated 2026-09-29 by `pipeline/reconcile.py` from `data/build/ledger.db`.


## Items loaded

| Dataset | Items | Total (CAD) |
|---|---:|---:|
| mha | 58,521 | $7,057,632.94 |
| sunshine | 34,493 | $4,406,623,501.22 |
| fed_grant | 29,297 | $8,515,817,579.02 |
| paradise | 17,916 | $119,578,978.41 |
| fed_contract | 8,536 | $2,631,253,175.29 |
| ppa | 6,326 | $1,358,279,875.68 |
| minister | 2,585 | $3,424,682.22 |
| pa_tp | 2,484 | $11,889,648,933.00 |
| stjohns | 640 | $19,311,414.77 |
| canadabuys | 538 | $855,968,652.83 |
| pa_pss | 358 | $690,028,445.00 |

## Provincial contract awards (PPA reports)

- Reports parsed: 154 PDFs listed on gov.nl.ca, 4 superseded by a REVISED issue, 150 used.
- Award rows: 6,363. Rows with a Canadian-dollar amount: 6,272.
- Rows priced only in US dollars (kept, not converted, not in totals): 60.
- Rows with a rate, range or prose instead of a price (kept, not in totals): 31.
- Rows with no award date printed: 115 (dated by report period end).
- The reports have no printed totals to reconcile against. Check instead: row counts per report are listed in `data/clean/ppa_awards.csv` and every row carries its page and table row.

Superseded issues (original dropped, revised kept):

- ppa/Contract-Award-Report-2025-10-01-To-2025-10-15.pdf (33 rows) replaced by ppa/Contract-Award-Report-2025-10-01-To-2025-10-15-Revised-1.pdf (33 rows)
- ppa/2025-Dec-01-15-Contract-Awards-Report.pdf (33 rows) replaced by ppa/2025-Dec-01-15-Contract-Awards-Report.REVISED.pdf (33 rows)
- ppa/2026-June-16-30-Contract-Awards-Report.pdf (92 rows) replaced by ppa/2026-June-16-30-Contract-Awards-Report.REVISED.pdf (92 rows)
- ppa/2026-August-1-15-Contract-Awards-Report.pdf (47 rows) replaced by ppa/2026-August-1-15-Contract-Awards-Report-REVISED.pdf (47 rows)

| Award year | Total (CAD) |
|---|---:|
| 2004 | $75,694.00 |
| 2019 | $214,930.00 |
| 2020 | $18,886,785.72 |
| 2021 | $121,168,507.55 |
| 2022 | $217,082,925.81 |
| 2023 | $272,573,768.82 |
| 2024 | $238,885,733.41 |
| 2025 | $260,901,967.17 |
| 2026 | $244,198,954.29 |
| 2027 | $28,259.00 |
| 2028 | $16,000.00 |
| 2035 | $12,825.00 |

## Ministerial expense claims

- Reports: 224 PDFs across 11 six-month periods (December 2020 to May 2026).
- Check: for every report, the parsed summary lines add up to the PDF's own printed Total line.
- Reports whose lines do not add to the PDF total: 0.
- Reports where the gov.nl.ca listing page shows a different total from the PDF (publisher discrepancy):
  - `ministers/ministerial-expense-claims-june-2025-november-2025/Paul-Pike-June-Nov-2025.pdf`: web page total $5,289.46 vs PDF total $15,289.46 (publisher discrepancy)
  - `ministers/ministerial-expense-claims-june-2023-november-2023/cabinet-expenseclaims-june23-nov23-loveless-e.pdf`: web page total $25,157.31 vs PDF total $23,157.31 (publisher discrepancy)

## MHA expense reports

- Detail lines: 58,521, total $7,057,632.94.
- Summary reports (spending by category): total $7,057,632.94.
- Detail total minus summary total: $0.00.
- Check: every category section's lines add up to its printed Period Activity. Sections that do not: 0.
- Annual reports that the House of Assembly links but that return a web page instead of a PDF: 8 (listed on the sources page).

## Compensation disclosure (sunshine list)

- Rows: 34,493 from 84 workbooks.
- Check: base + overtime + bonus + shift + retroactive + severance + other equals the published total within rounding ($100 per field). Rows outside that: 38.
- Workbooks listed on gov.nl.ca that return 404: 19.
  - 2022: 5,047 people
  - 2023: 3,030 people
  - 2024: 12,607 people
  - 2025: 13,809 people

## Federal contracts, grants and notices

- Contracts over $10K to suppliers with an NL postal code: 9,882 rows worth $11,888,299,441.12 as published.
- Each amendment repeats the whole contract. Grouped by (procurement id, cleaned vendor name) across departments, latest kept: 8,536 contracts worth $2,631,253,175.29. An earlier grouping by department and raw vendor name gave about $2.83B; it counted a purchase order twice when two departments reported it or the vendor was spelled two ways.
- Non-competitive (solicitation code TN): $210,910,392.52.
- Grants and contributions to NL recipients: 35,876 rows worth $11,680,096,859.79. One value per agreement (department, agreement number, recipient): latest amendment where the department reports running totals, amendments summed where it reports changes (aandc-aadnc, isc-sac): 29,297 agreements worth $8,515,817,579.02. Agreement values can span several years.
- CanadaBuys award notices with an NL supplier: 538 ($855,968,652.83). These overlap the contracts disclosure and are never added to totals.

Major federal transfers to NL, 2024-25 (Public Accounts, $ millions as published):

- Old age security benefits: $1,569,000,000.00
- Canada Health Transfer: $688,000,000.00
- Canada Social Transfer: $224,000,000.00
- Fiscal arrangements: $228,000,000.00
- Quebec Abatement: $0.00
- Employment Insurance and support measures: $1,228,000,000.00
- Children's benefits: $0.00
- COVID-19 income support for workers: $0.00
- Canada-wide Early Learning and Child Care: $0.00
- Other major transfers: $318,000,000.00

## Department and program spending

- Check: for each department and account (current, capital), gross expenditure summed from the parsed object lines equals the department's gross expenditure in the report's own summary statement (rounded to $000). 173 of 175 match.
  - 2019-20 transportation and works (CURRENT): summary $349,181,000.00, parsed $347,848,250.00.
  - 2024-25 labrador affairs (CURRENT): summary $16,697,000.00, parsed nothing. The 2024-25 report prints Labrador Affairs detail pages with only a heading and '#MISSING'; the source has no lines to parse.
- 2019-20 actual: gross expenditure $8,212,926,310.00
- 2020-21 actual: gross expenditure $7,929,214,100.00
- 2021-22 actual: gross expenditure $8,880,154,489.00
- 2022-23 actual: gross expenditure $9,110,447,041.00
- 2023-24 actual: gross expenditure $9,571,838,311.00
- 2024-25 actual: gross expenditure $10,628,156,038.00
- 2026-27 estimates: gross expenditure $12,903,424,100.00

## Municipal payments

- Paradise: 56 register files downloaded; 48 distinct monthly registers used; 17,916 payment lines, $119,578,978.41.
- Lines that look like payments but did not parse: 71 (mostly wrapped descriptions). Registers from early 2020 use a different layout and are not loaded.
- The registers print no totals, so there is nothing to reconcile the sum against.
- St. John's: the first 12 pages of the 2026 weekly-voucher PDF were read with OCR as a sample. Cover memos (payroll and weekly totals) are excluded. OCR text can misread characters; each row links to its page.
