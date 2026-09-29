# Review notes

Three independent reviews ran on 2026-09-29 against the live site, each by a reviewer with no part in building it: a source trace, a hostile read of the figures and wording, and a design review. This file records what they found and what was done.

## 1. Source trace (30 items)

- Scope: the 22 random items in `docs/trace-sample.md` plus 8 picked at random from live search results.
- Every item was compared with its source row (cached copy, and the live file for 18 of them: byte-identical) and with its page on the site.
- Result: all 34 amounts match to the cent; every date, payee and buyer matches. No link opened the wrong PDF page.

Problems found, and what was done:

| Finding | Action |
|---|---|
| Federal grant source links opened a blank page | Fixed: links now use the `,current` record form |
| Item and search pages dropped cents | Fixed: cents shown whenever the source has them |
| Federal "limited tendering reason" showed the raw code "00" | Fixed: code 00 shown as none |
| One program name cut mid-word | Fixed: long text is clipped at a word with an ellipsis |
| Pay records showed base salary only | Fixed: every published pay component shown |
| PPA locator "table row 12" was the extractor's row, not the 8th award | Fixed: "award 8 in the table on that page" |
| Minister links go to the summary page, not the claim detail | Fixed: locator names the detail page too |
| CanadaBuys amounts are totals after amendments, undisclosed | Fixed: the record says so |
| Grant date is the agreement start, not the amendment | Fixed: labelled "Agreement start" |

Source quirks inherited as published: a supplier typo ("ECTRICAL"), one federal record whose original plus amendment does not equal its contract value.

## 2. Hostile read: figures and wording

### Must fix (all fixed before redeploy)

| Finding | Action | Figure before | Figure after |
|---|---|---|---|
| Federal grants double-counted: several departments give each amendment a new reference number | Grouped by department, agreement number and recipient; latest amendment kept where a department reports running totals, amendments summed where it reports changes (Indigenous Services, CIRNAC) | $10.70B | $8.67B |
| Federal contracts double-counted: vendor spelled differently across amendments; Coast Guard purchase orders reported by both DFO and DND | Grouped by purchase order and cleaned vendor name across departments; two placeholder "Company XYZ" records dropped | $2.80B | $2.63B |
| Supplier pages added payment records on top of the contracts and grants they pay | Headline counts contracts, grants, awards and payments; Public Accounts payments and CanadaBuys notices shown apart as overlapping | Nunatsiavut $1.8B | $1.18B plus $640M overlapping, shown separately |
| Severance and overtime showed total pay, not the severance or overtime | Now the severance and overtime amounts, as person-years | $53.9M / $46.1M | $10.3M / $23.5M |
| Pay flags named individuals under the patterns heading; split-invoices named an individual contractor | Pay flags shown by employer and job title only; vendors printed as a person's name and standing-offer call-ups excluded from split-invoices; patterns intro rewritten | | |
| Tender limits were not the law ($10K/$50K/$100K) and the clauses were attributed to the Act | Thresholds now from Public Procurement Regulations s.5 by type of body (read on assembly.nl.ca); clauses attributed to the Regulations s.6 | | |
| Home examples named a private landlord and read as partisan | Examples are now categories (all MHA office rent, all ministers' claims in a period) and a contract; the scale page no longer names a member | | |

One disagreement: the reviewer estimated grants at $6.0B to $7.9B and Nunatsiavut at about $0.3B. The low end is what reading Indigenous Services and Crown-Indigenous Relations as running totals gives. Their rows show they report changes: negative restatements noted "The total award value of $275,513,967.08 reported in a previous quarter has been reduced by this Amendment" (CIRNAC 2021-HQ-000099), and late amendments noted "Funding of $X actually awarded" where X is the row's own value. Public Accounts settles it: the two departments paid NL recipients $933M and $627M in 2021-22 to 2024-25 alone, against $124M and $186M for all years if only their latest rows counted, and Indigenous Services' 2024-25 child and family services agreement with the province adds to $54,115,591 across four change rows, the amount paid that year. The site sums their rows. A second pass (#320) found Canadian Heritage and the Public Health Agency also report changes, and some agreements counted twice (renamed recipients, Infrastructure Canada agreements without a number): $8.51B became $8.43B, range $8.37B to $8.43B depending on how Heritage and the Public Health Agency are read.

### Should fix

| Finding | Action |
|---|---|
| Receipt ignored the low-income tax reduction | Fixed: $997 less 16% over $23,928 (form NL428 2025); CPP and EI credits still not applied, stated |
| CRA link 404 | Fixed: CRA 2025 rates page |
| Home "by level" note and "Received" labels | Fixed wording: agreement values, may span years; not one year's spending |
| Federal "8,569 NL suppliers" counted contracts | Fixed wording |
| Postal code is not where work happens | Caveat added on the federal page |
| Provincial awards printed twice across reports | Repeats (same contract number, supplier and price) loaded once and listed on the report card |
| Population year | Fixed: July 1, 2024 for 2024-25 spending |
| "Doctors' fee-for-service billing" label | Fixed: "Professional services in the Physician Services program" |
| Unsourced interest explanation | Rewritten and cited |
| CanadaBuys old-style ids 404 | Those link to the dataset instead |
| Loaded wording (late publication motive, "2006 scandal", "payments" count) | Rewritten |
| Receipt input "-5" and "1e308" | Fixed: invalid input rejected with a message |

### Not fixed

- Supplier names are matched by normalised text only: "Microsoft" and "Microsoft Canada Inc." stay separate.
- Minister PDF file names are not dated and may be overwritten by the government.
- The possible-duplicate flag is mostly pension remittances: noisy, low harm.

## 3. Design review

- Eight layout fixes were made: flat call-outs in place of shadowed cards, bars drawn against a named total, a clipped cover field, gold kept for call-outs only, remainder rows and a budget column, ruled schedule lines in place of number tiles, double rules, and the fiscal-year population.
- A second pass found four phone-layout problems: figures breaking mid-number, the priorities table clipping its Budgeted column, "$11 billion" without a decimal, and a detached footnote marker. All four were fixed and checked on the live site at 390px wide.
- Not built: department tabs down the page edge and page numbers.
- `DESIGN.md` describes the design system as built.
