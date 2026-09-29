# Supplier matching

Generated 2026-09-29 by `pipeline/suppliers.py`. A supplier page groups every record whose printed name is the same supplier. This page says how names are joined, how many were joined, and which close names were left apart. To question a merge or ask for one, open the **Challenge a method** issue form; a decision goes into `pipeline/supplier_rules.csv` with its reason.

## Method

- **Same name.** Case, accents, apostrophes, punctuation and legal suffixes (Inc., Ltd., Limited, Corp., Ltée) are set aside, "NL" and "Nfld" are written out, and anything after "o/a", "c/o" or "formerly" is dropped: the record belongs to the legal name before it.
- **Bilingual.** Federal grant records print the recipient as "English name|French name"; both halves are the same recipient.
- **Business number.** Federal grant records with the same valid business number (Luhn check digit; department placeholders such as 000000000 and 1000xxxxx are ignored) are joined when the names are a spelling slip apart or one name is inside the other.
- **Postal code.** Federal records with the same postal code are joined when the names are a spelling slip apart.
- **Reviewed.** Decisions in `pipeline/supplier_rules.csv`, each with its reason: merges the evidence above cannot make (a typo in a provincial report, which prints no business number), and pairs kept apart.
- **Never joined:** operating names ("Cavendish Hotel LP o/a Sheraton" is not joined to other Sheraton records: franchise names are shared by different owners), a parent and its subsidiary (Microsoft Corporation and Microsoft Canada Inc. are different companies unless a record shows otherwise), and close names with no evidence.
- Totals: a supplier's headline total counts contract awards, grant agreements and payments once. Public Accounts payment lines and CanadaBuys notices repeat money already counted and stay out of it, whichever name they were printed under.

## Counts

- Name keys (names after the same-name step): 14,329.
- Suppliers after joining: 13,273.
- Name keys folded into another: 1,056 (635 business number, 203 same name, 90 postal code, 73 bilingual, 33 unit, 18 reviewed, 4 same award).
- Close names left apart: 2,496 (`docs/supplier-near-matches.csv`).
- Joins stopped by a reviewed "apart" decision: 0.

## Largest merges by value

| Supplier | Names joined | Records | Value | Evidence |
|---|---|---:|---:|---|
| Government of Newfoundland and Labrador | Province of Newfoundland and Labrador; Government of Newfoundland and Labrador - Department of Health and Community Services; GOVERNMENT OF NEWFOUNDLAND AND LABRADOR NEWFOUNDLAND EXCHEQUER ACCOUNT; NEWFOUNDLAND EXCHEQUER ACCOUNT; and 10 more | 376 | $1,573,436,940 | bilingual, reviewed, same name, unit |
| Nunatsiavut Government | Nunatsiavut Government, Department of Health & Social Development; Nunatsiavut Government - Department of Health and Social Development (DHSD); Nunatsiavut Government - DHSD; NUNATISIAVUT GOVERNMENT; and 3 more | 250 | $1,234,313,601 | bilingual, business number, postal code, unit |
| Memorial University of Newfoundland | Memorial University; Grenfell Campus, Memorial University of Newfoundland; Memorial University of Newfoundland and Labrador; Fisheries & Marine Institute of Memorial University of Nfld.; and 37 more | 907 | $400,418,966 | bilingual, business number, postal code, same award, same name, unit |
| Mushuau Innu First Nation | Mushuau Innu First Nation Innu Band Council | 84 | $294,478,295 | business number |
| St. John's Dockyard | NEWDOCK - ST. JOHN'S DOCKYARD LTD | 70 | $269,128,600 | reviewed |
| Sheshatshiu Innu First Nation | Sheshatshiu Innu Band Council; premiere nation innue sheshatshiu | 115 | $224,746,961 | bilingual, reviewed |
| Qalipu Mi'kmaq First Nation Band | Qalipu Mi'kmaq First Nation; Qalipu First Nation Band; Qalipu First Nation; Qalipu Mi'kmaq First Nations Band; and 2 more | 154 | $191,451,770 | bilingual, business number, reviewed, same name |
| Association for New Canadians | Association for New Canadians/Association pour les nouveaux Canadiens; association pour les nouveaux canadiens | 164 | $159,343,289 | bilingual, business number |
| Microsoft Canada Inc. | Microsoft; Microsoft Cooperation | 40 | $140,426,797 | reviewed |
| CITY OF ST. JOHN'S | City of St. John's Municipal Council; CITY OF ST. JOHNS'S; ville de st johns; ville de st jean de tn | 273 | $124,927,657 | bilingual, business number, reviewed |
| RJG CONSTRUCTION LTD | R.J.G. Construction Limited | 58 | $117,242,308 | same name |
| Braya Renewable Fuels (Newfoundland) LP | BRAYA RENEWABLES FUELS (NEWFOUNDLAND) LP | 4 | $86,863,420 | postal code |
| NUNATUKAVUT COMMUNITY COUNCIL INC. | NunatuKavut | 232 | $77,697,837 | business number |
| Newfoundland and Labrador | terre neuve et labrador | 15 | $65,666,091 | bilingual |
| NARL MARKETING LIMITED PARTNERSHIP | NARL MARKETING LIMITED PARTNERSHIP NORTH ATLANTIC | 416 | $61,871,308 | reviewed |
| JCL Investments Inc. | JCL Investments Inc Corner | 17 | $61,243,542 | reviewed |
| Energy Research and Innovation Newfoundland and Labrador | Petroleum Research Newfoundland and Labrador | 16 | $61,064,432 | reviewed |
| NEWFOUNDLAND AND LABRADOR DEPARTMENT OF JUSTICE AND PUBLIC SAFETY | NEWFOUNDLAND AND LABRADOR DEPARTMENT OF JUSTICE AND PUBLIC SAFETY, VICTIM SERVICES BRANCH; ministere de la justice et de la securite publique de terre neuve et labrador; terre neuve et labrador ministere de la justice et de la securite publique direction des services aux victimes | 21 | $55,705,739 | bilingual |
| Town of Grand Falls-Windsor | ville de grand falls windsor | 66 | $48,761,197 | bilingual |
| Labrador Friendship Centre | centre damitie du labrador | 52 | $36,223,612 | bilingual |
| St. John's International Airport Authority | autorite aeroportuaire de st johns international | 17 | $34,695,751 | bilingual |
| Miawpukek First Nation | Miawpukek Mi'kamawey Mawi'omi; Miawpukek First Nations; MIAWPUKEK FIRST NATION - ST. ANNE'S SCHOOL | 179 | $32,366,012 | postal code, reviewed, unit |
| J.M.J. HOLDINGS LTD. | JMJ Holdings Ltd | 3 | $29,136,157 | same name |
| FIRST LIGHT ST. JOHN'S FRIENDSHIP CENTRE INC. | St. John's Native Friendship Centre; FIRST LIGHT ST JOHN S FRIENDSHIP CENTRE INC; FIRST LIGHT ST.JOHN'S NATIVE FRIENDSHIP CENTRE; First Light St. John's Friendship Center | 111 | $28,423,027 | business number, same name |
| FLOYD'S CONSTRUCTION LTD | FLOYD'S CONSTRUCTON LTD | 41 | $24,957,747 | same award |

## Close names left apart (largest 30)

| Name | Other name | Why not joined |
|---|---|---|
| NARL MARKETING LIMITED PARTNERSHIP ($48,188,884) | NARL Marketing Inc., NORTH ATLANTIC REFINING CORP., in Joint Venture ($42,267,138) | one name inside the other (often a parent and its subsidiary or branch) |
| Braya Renewable Fuels ($37,363,420) | Braya Renewable Fuels (Newfoundland) LP ($98,781,465) | one name inside the other (often a parent and its subsidiary or branch) |
| NEWFOUNDLAND AND LABRADOR DEPARTMENT OF JUSTICE AND PUBLIC SAFETY ($46,374,110) | Province of Newfoundland and Labrador, Department of Justice and Public Safety ($27,253,603) | one name inside the other (often a parent and its subsidiary or branch) |
| Memorial University of Newfoundland ($539,861,264) | Thomas, Raymond-Memorial University of Newfoundland ($14,961,023) | one name inside the other (often a parent and its subsidiary or branch) |
| NARL MARKETING LIMITED PARTNERSHIP NORTH ATLANTIC ($13,682,424) | NARL Marketing Inc., NORTH ATLANTIC REFINING CORP., in Joint Venture ($42,267,138) | one name inside the other (often a parent and its subsidiary or branch) |
| GE Healthcare ($10,009,005) | GE Healthcare Canada ($31,793,963) | one name inside the other (often a parent and its subsidiary or branch) |
| Newfoundland and Labrador Association of Technology and Innovation Inc. ($84,136,752) | Newfoundland and Labrador Association of Technology Industries Incorporated ($9,977,876) | same business number, different names (a parent body's number, or an owner's) |
| Department of Industry, Energy and Technology ($9,194,653) | Government of Newfoundland and Labrador ($1,922,715,201) | same business number, different names (a parent body's number, or an owner's) |
| Department of Industry, Energy and Technology ($9,194,653) | Province of Newfoundland and Labrador ($5,642,255,971) | same business number, different names (a parent body's number, or an owner's) |
| Department of Industry, Energy and Technology ($9,194,653) | Department of Tourism Culture Arts and Recreation ($7,008,090) | same business number, different names (a parent body's number, or an owner's) |
| Department of Tourism Culture Arts and Recreation ($7,008,090) | Government of Newfoundland and Labrador ($1,922,715,201) | same business number, different names (a parent body's number, or an owner's) |
| Department of Tourism Culture Arts and Recreation ($7,008,090) | Province of Newfoundland and Labrador ($5,642,255,971) | same business number, different names (a parent body's number, or an owner's) |
| Horizon économique de Terre-Neuve-et-Labrador Inc. ($7,498,237) | Reseau de Developpement Economique et d'Employabilite de Terre-Neuve-et-Labrador ($6,730,044) | same business number, different names (a parent body's number, or an owner's) |
| Department of Energy and Mines ($6,500,000) | Department of Industry, Energy and Technology ($9,194,653) | same business number, different names (a parent body's number, or an owner's) |
| Department of Energy and Mines ($6,500,000) | Department of Tourism Culture Arts and Recreation ($7,008,090) | same business number, different names (a parent body's number, or an owner's) |
| Department of Energy and Mines ($6,500,000) | Government of Newfoundland and Labrador ($1,922,715,201) | same business number, different names (a parent body's number, or an owner's) |
| Department of Energy and Mines ($6,500,000) | Province of Newfoundland and Labrador ($5,642,255,971) | same business number, different names (a parent body's number, or an owner's) |
| Fisheries & Marine Institute of Memorial University of Nfld. ($14,594,248) | Fisheries and Marine Institute of the Memorial University of Newfoundland and Labrador ($5,188,643) | one name inside the other (often a parent and its subsidiary or branch) |
| Newfoundland and Labrador Minister of Fisheries, Forestry and Agriculture ($5,125,000) | Newfoundland and Labrador Minister of Fisheries, Forestry and Agriculture and Minister IA ($5,125,000) | one name inside the other (often a parent and its subsidiary or branch) |
| D F BARNES LIMITED ($3,760,422) | D.F. Barnes Fabrication Limited ($4,529,716) | one name inside the other (often a parent and its subsidiary or branch) |
| D F BARNES LIMITED ($3,760,422) | D.F. Barnes Services Limited ($10,204,267) | one name inside the other (often a parent and its subsidiary or branch) |
| Commissionaires ($3,699,768) | COMMISSIONAIRES NL ($4,760,913) | one name inside the other (often a parent and its subsidiary or branch) |
| Commissionaires ($3,699,768) | COMMISSIONAIRES OF NFLD ($8,385,847) | one name inside the other (often a parent and its subsidiary or branch) |
| CANADIAN CORPS COMMISSIONAIRES ($5,471,332) | Commissionaires ($3,699,768) | one name inside the other (often a parent and its subsidiary or branch) |
| CANADIAN CORPS OF COMMISSIONAIRES ($11,500,082) | Commissionaires ($3,699,768) | one name inside the other (often a parent and its subsidiary or branch) |
| Miawpukek First Nation ($33,057,046) | Netukulimk Fisheries Limited ($3,692,479) | same business number, different names (a parent body's number, or an owner's) |
| Miawpukek Mi'kamawey Mawi'omi ($16,446,753) | Netukulimk Fisheries Limited ($3,692,479) | same business number, different names (a parent body's number, or an owner's) |
| 10566 Energy NL Inc. ($4,636,349) | Newfoundland & Labrador Oil & Gas Industries Association Inc. ($3,612,279) | same business number, different names (a parent body's number, or an owner's) |
| Emmanuel Construction ($5,079,001) | Emmanuel Construction Services Ltd ($3,309,490) | one name inside the other (often a parent and its subsidiary or branch) |
| The Excite Corporation Inc. ($3,145,609) | Town of Grand Falls-Windsor ($57,319,038) | same business number, different names (a parent body's number, or an owner's) |

Every merge, with its evidence: `docs/supplier-merges.csv`.
