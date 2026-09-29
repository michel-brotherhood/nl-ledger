# Supplier matching

Generated 2026-09-29 by `pipeline/suppliers.py`. A supplier page groups every record whose printed name is the same supplier. This page says how names are joined, how many were joined, and which close names were left apart. To question a merge or ask for one, open the **Challenge a method** issue form; a decision goes into `pipeline/supplier_rules.csv` with its reason.

## Method

- **Same name.** Case, accents, apostrophes, punctuation and legal suffixes (Inc., Ltd., Limited, Corp., Ltée) are set aside, "NL" and "Nfld" are written out, and anything after "o/a", "c/o" or "formerly" is dropped: the record belongs to the legal name before it.
- **Bilingual.** Federal grant records print the recipient as "English name|French name"; both halves are the same recipient.
- **Business number.** Federal grant records with the same valid business number (Luhn check digit; department placeholders such as 000000000 and 1000xxxxx are ignored; the full account where printed, since an umbrella body holds a charity account per branch) are joined when the names are a spelling slip apart, or one name is inside the other and adds only words such as Inc., Association or Council.
- **Postal code.** Federal records with the same postal code are joined when the names are a spelling slip apart (initials must match) and no different business numbers are printed with them.
- **Same award.** A federal contract and a CanadaBuys notice with the same award date and value to the cent.
- **Department or campus.** A department, faculty or campus printed after its body's name.
- **Reviewed.** Decisions in `pipeline/supplier_rules.csv`, each with its reason: merges the evidence above cannot make (a typo in a provincial report, which prints no business number), and pairs kept apart.
- **Never joined:** operating names ("Cavendish Hotel LP o/a Sheraton" is not joined to other Sheraton records: franchise names are shared by different owners), a company and its limited partnership, a parent and its subsidiary unless a reviewed decision says why, and close names with no evidence.
- Totals: a supplier's headline total counts contract awards, grant agreements and payments once. Public Accounts payment lines and CanadaBuys notices repeat money already counted and stay out of it, whichever name they were printed under.

## Counts

- Name keys (names after the same-name step): 12,661.
- Suppliers after joining: 11,980.
- Name keys folded into another: 681 (341 business number, 190 same name, 68 bilingual, 32 unit, 28 postal code, 19 reviewed, 3 same award).
- Names printed more than one way (same name once spelling is set aside): 3,007, listed in `docs/supplier-merges.csv` with their other printings.
- Close names left apart: 2,701 (`docs/supplier-near-matches.csv`).
- Joins stopped by a reviewed "apart" decision: 0.

## Largest merges by value

| Supplier | Names joined | Records | Value | Evidence |
|---|---|---:|---:|---|
| Government of Newfoundland and Labrador | Province of Newfoundland and Labrador; Government of Newfoundland and Labrador - Department of Health and Community Services; GOVERNMENT OF NEWFOUNDLAND AND LABRADOR NEWFOUNDLAND EXCHEQUER ACCOUNT; Newfoundland Exchequer Account; and 11 more | 297 | $1,573,979,281 | bilingual, reviewed, same name, unit |
| Nunatsiavut Government | Nunatsiavut Government, Department of Health & Social Development; Nunatsiavut Government - Department of Health and Social Development (DHSD); NUNATISIAVUT GOVERNMENT; gouvernement nunatsiavut; and 2 more | 249 | $1,234,153,321 | bilingual, postal code, unit |
| Memorial University of Newfoundland | Memorial University; Grenfell Campus, Memorial University of Newfoundland; Memorial University of Newfoundland and Labrador; Fisheries & Marine Institute of Memorial University of Nfld.; and 16 more | 868 | $383,772,119 | bilingual, business number, same name, unit |
| Mushuau Innu First Nation | Mushuau Innu First Nation Innu Band Council | 84 | $294,478,295 | business number |
| St. John's Dockyard | NEWDOCK - ST. JOHN'S DOCKYARD LTD | 67 | $252,102,485 | reviewed |
| Sheshatshiu Innu First Nation | Sheshatshiu Innu Band Council; premiere nation innue sheshatshiu | 115 | $224,746,961 | bilingual, reviewed |
| Qalipu Mi'kmaq First Nation Band | Qalipu Mi'kmaq First Nation; Qalipu First Nation Band; Qalipu First Nation; Qalipu Mi'kmaq First Nations Band; and 2 more | 154 | $191,451,770 | bilingual, business number, reviewed, same name |
| Association for New Canadians | association pour les nouveaux canadiens | 162 | $152,996,334 | bilingual |
| Microsoft Canada Inc. | Microsoft; Microsoft Cooperation | 40 | $140,426,797 | reviewed |
| RJG CONSTRUCTION LTD | R.J.G. Construction Limited | 58 | $117,242,308 | same name |
| City of St. John's | City of St. John's Municipal Council; CITY OF ST. JOHNS'S; ville de st johns; ville de st jean de tn | 116 | $97,651,653 | bilingual, business number, reviewed |
| Braya Renewable Fuels (Newfoundland) LP | BRAYA RENEWABLES FUELS (NEWFOUNDLAND) LP | 4 | $86,863,420 | postal code |
| NUNATUKAVUT COMMUNITY COUNCIL INC. | NunatuKavut | 235 | $78,183,837 | business number |
| Newfoundland and Labrador | terre neuve et labrador | 15 | $65,666,091 | bilingual |
| NARL MARKETING LIMITED PARTNERSHIP | NARL MARKETING LIMITED PARTNERSHIP NORTH ATLANTIC | 415 | $61,737,547 | reviewed |
| JCL Investments Inc. | JCL Investments Inc Corner | 17 | $61,243,542 | reviewed |
| Energy Research and Innovation Newfoundland and Labrador | Petroleum Research Newfoundland and Labrador | 16 | $61,064,432 | reviewed |
| NEWFOUNDLAND AND LABRADOR DEPARTMENT OF JUSTICE AND PUBLIC SAFETY | NEWFOUNDLAND AND LABRADOR DEPARTMENT OF JUSTICE AND PUBLIC SAFETY, VICTIM SERVICES BRANCH; ministere de la justice et de la securite publique de terre neuve et labrador; terre neuve et labrador ministere de la justice et de la securite publique direction des services aux victimes | 21 | $55,705,739 | bilingual |
| Town of Grand Falls-Windsor | ville de grand falls windsor | 66 | $48,761,197 | bilingual |
| Labrador Friendship Centre | centre damitie du labrador | 52 | $36,223,612 | bilingual |
| St. John's International Airport Authority | autorite aeroportuaire de st johns international | 17 | $34,695,751 | bilingual |
| Miawpukek First Nation | Miawpukek Mi'kamawey Mawi'omi; Miawpukek First Nations; MIAWPUKEK FIRST NATION - ST. ANNE'S SCHOOL | 179 | $32,366,012 | postal code, reviewed, unit |
| J.M.J. HOLDINGS LTD. | JMJ Holdings Ltd | 3 | $29,136,157 | same name |
| FIRST LIGHT ST. JOHN'S FRIENDSHIP CENTRE INC. | St. John's Native Friendship Centre; FIRST LIGHT ST JOHN S FRIENDSHIP CENTRE INC; First Light St. John's Friendship Center | 106 | $28,420,272 | business number, reviewed, same name |
| FLOYD'S CONSTRUCTION LTD | FLOYD'S CONSTRUCTON LTD | 41 | $24,957,747 | same award |

## Close names left apart (largest 30)

| Name | Other name | Why not joined |
|---|---|---|
| NEWFOUNDLAND AND LABRADOR DEPARTMENT OF JUSTICE AND PUBLIC SAFETY ($46,374,110) | Province of Newfoundland and Labrador, Department of Justice and Public Safety ($27,253,603) | one name inside the other (often a parent and its subsidiary or branch) |
| GE Healthcare ($10,009,005) | GE Healthcare Canada ($31,793,963) | one name inside the other (often a parent and its subsidiary or branch) |
| Newfoundland and Labrador Association of Technology and Innovation Inc. ($84,136,752) | Newfoundland and Labrador Association of Technology Industries Incorporated ($9,977,876) | same business number, different names (a parent body's number, or an owner's) |
| Department of Industry, Energy and Technology ($9,194,653) | Government of Newfoundland and Labrador ($1,922,657,096) | same business number, different names (a parent body's number, or an owner's) |
| Department of Industry, Energy and Technology ($9,194,653) | Province of Newfoundland and Labrador ($5,643,235,971) | same business number, different names (a parent body's number, or an owner's) |
| Department of Industry, Energy and Technology ($9,194,653) | Department of Tourism Culture Arts and Recreation ($7,008,090) | same business number, different names (a parent body's number, or an owner's) |
| Department of Tourism Culture Arts and Recreation ($7,008,090) | Government of Newfoundland and Labrador ($1,922,657,096) | same business number, different names (a parent body's number, or an owner's) |
| Department of Tourism Culture Arts and Recreation ($7,008,090) | Province of Newfoundland and Labrador ($5,643,235,971) | same business number, different names (a parent body's number, or an owner's) |
| Horizon économique de Terre-Neuve-et-Labrador Inc. ($7,498,237) | Reseau de Developpement Economique et d'Employabilite de Terre-Neuve-et-Labrador ($6,730,044) | same business number, different names (a parent body's number, or an owner's) |
| Department of Energy and Mines ($6,500,000) | Department of Industry, Energy and Technology ($9,194,653) | same business number, different names (a parent body's number, or an owner's) |
| Department of Energy and Mines ($6,500,000) | Department of Tourism Culture Arts and Recreation ($7,008,090) | same business number, different names (a parent body's number, or an owner's) |
| Department of Energy and Mines ($6,500,000) | Government of Newfoundland and Labrador ($1,922,657,096) | same business number, different names (a parent body's number, or an owner's) |
| Department of Energy and Mines ($6,500,000) | Province of Newfoundland and Labrador ($5,643,235,971) | same business number, different names (a parent body's number, or an owner's) |
| Fisheries & Marine Institute of Memorial University of Nfld. ($14,594,248) | MEMORIAL UNIVERSITY OF NEWFOUNDLAND FINANCIAL AND ADMINISTRATIVE SERVICES ($5,444,430) | same business number, different names (a parent body's number, or an owner's) |
| Memorial University ($8,142,667) | MEMORIAL UNIVERSITY OF NEWFOUNDLAND FINANCIAL AND ADMINISTRATIVE SERVICES ($5,444,430) | same business number, different names (a parent body's number, or an owner's) |
| Memorial University of Newfoundland ($540,165,410) | MEMORIAL UNIVERSITY OF NEWFOUNDLAND FINANCIAL AND ADMINISTRATIVE SERVICES ($5,444,430) | same business number, different names (a parent body's number, or an owner's) |
| Fisheries & Marine Institute of Memorial University of Nfld. ($14,594,248) | Fisheries and Marine Institute of the Memorial University of Newfoundland and Labrador ($5,188,643) | one name inside the other (often a parent and its subsidiary or branch) |
| Fédération des francophones de Terre-Neuve et du Labrador ($8,260,814) | FÉDÉRATION DES FRANCOPHONES DE TERRE-NEUVE ET DU LABRADOR (LA) ($3,881,154) | one name inside the other (often a parent and its subsidiary or branch) |
| D F BARNES LIMITED ($3,760,422) | D.F. Barnes Services Limited ($10,204,267) | one name inside the other (often a parent and its subsidiary or branch) |
| Commissionaires ($3,699,768) | COMMISSIONAIRES NL ($4,760,913) | one name inside the other (often a parent and its subsidiary or branch) |
| Commissionaires ($3,699,768) | COMMISSIONAIRES OF NFLD ($8,385,847) | one name inside the other (often a parent and its subsidiary or branch) |
| Miawpukek First Nation ($33,057,046) | Netukulimk Fisheries Limited ($3,692,479) | same business number, different names (a parent body's number, or an owner's) |
| Miawpukek Mi'kamawey Mawi'omi ($16,446,753) | Netukulimk Fisheries Limited ($3,692,479) | same business number, different names (a parent body's number, or an owner's) |
| 10566 Energy NL Inc. ($4,634,795) | Newfoundland & Labrador Oil & Gas Industries Association Inc. ($3,612,279) | same business number, different names (a parent body's number, or an owner's) |
| Emmanuel Construction ($5,079,001) | Emmanuel Construction Services Ltd ($3,309,490) | one name inside the other (often a parent and its subsidiary or branch) |
| The Excite Corporation Inc. ($3,145,609) | Town of Grand Falls-Windsor ($57,319,038) | same business number, different names (a parent body's number, or an owner's) |
| NEWFOUNDLAND AND LABRADOR DEPARTMENT OF JUSTICE AND PUBLIC SAFETY ($46,374,110) | Newfoundland & Labrador Justice and Public Safety ($3,100,253) | one name inside the other (often a parent and its subsidiary or branch) |
| Newfoundland & Labrador Justice and Public Safety ($3,100,253) | Province of Newfoundland and Labrador, Department of Justice and Public Safety ($27,253,603) | one name inside the other (often a parent and its subsidiary or branch) |
| Bluedrop ISM Limited ($3,075,000) | Bluedrop Performance Learning Inc. ($14,278,677) | same business number, different names (a parent body's number, or an owner's) |
| Fédération des francophones de Terre-Neuve et du Labrador ($8,260,814) | Fédération des francophones de Terre-Neuve-et-Labrador Inc ($2,695,925) | one name inside the other (often a parent and its subsidiary or branch) |

Every merge, with its evidence: `docs/supplier-merges.csv`.
