"""Canonical names for public bodies as printed in the PPA award reports.

The reports spell the same body many ways ("NL Hydro", "Newfoundland and Labrador
Hydro"; "Public Procurement Agnecy"; health-authority zones). Each printed name maps
to one canonical body. The printed name is kept on every item as published.
Renamed departments are not merged: a department's name at the time is what the
report says, and the site links old and new names on their pages.
"""
import re

RULES = [
    (r"hydro\b", "Newfoundland and Labrador Hydro"),
    (r"^(nl|newfoundland (and|&) labrador) (centre|center) for health info|\(nl centre for health information\)", "NL Centre for Health Information"),
    (r"nl hea?lth services?|newfoundland (and|&) labrador health services|nl health service\b|nl heath", "NL Health Services"),
    (r"^eastern (regional )?health|^eastern regional health authority", "Eastern Health (regional health authority)"),
    (r"^central (regional )?health", "Central Health (regional health authority)"),
    (r"^western (regional )?health", "Western Health (regional health authority)"),
    (r"labrador.?grenfell", "Labrador-Grenfell Health (regional health authority)"),
    (r"regional health authorities", "Regional health authorities (joint)"),
    (r"public procur[a-z]* agn?e[a-z]*cy|public procurment agency|^ppa$", "Public Procurement Agency"),
    (r"chief information officer|^ocio$|-ocio", "Office of the Chief Information Officer"),
    (r"liquor corp|^nlc$", "NL Liquor Corporation"),
    (r"oil ?co\b|oil and gas corporation", "Oil and Gas Corporation of NL"),
    (r"transportation (and|&) (infrastructure|infrastru|works)", "Department of Transportation and Infrastructure"),
    (r"^(department of )?education (and|&) early childhood", "Department of Education and Early Childhood Development"),
    (r"^(department of )?education$", "Department of Education"),
    (r"^(department of )?fisheries, forestry (and|&) (agriculture|aquaculture)", "Department of Fisheries, Forestry and Agriculture"),
    (r"^(department of )?industry, energy (and|&) technology", "Department of Industry, Energy and Technology"),
    (r"^(department of )?tourism, culture,? arts,? (and|&) recreation|^tourism, culture (and|&) recreation", "Department of Tourism, Culture, Arts and Recreation"),
    (r"^(department of )?justice (and|&) public safety", "Department of Justice and Public Safety"),
    (r"^(department of )?finance$", "Department of Finance"),
    (r"^(department of )?executive council$|^executive council, office of the chief executive", "Executive Council"),
    (r"^(department of )?digital government", "Department of Digital Government and Service NL"),
    (r"^(department of )?environment (and|&) climate change", "Department of Environment and Climate Change"),
    (r"^(department of )?health (and|&) community services", "Department of Health and Community Services"),
    (r"english school district|nlesd", "Newfoundland and Labrador English School District"),
    (r"college of the north atlantic", "College of the North Atlantic"),
    (r"^(the )?city of st\.? john", "City of St. John's"),
    (r"^(the )?town of gander", "Town of Gander"),
    (r"nalcor", "Nalcor Energy"),
    (r"labrador island link|^lil lp", "Labrador Island Link LP"),
    (r"^(department of )?labrador affairs", "Labrador Affairs"),
    (r"royal newfoundland constabulary", "Royal Newfoundland Constabulary"),
]
_COMPILED = [(re.compile(p, re.I), name) for p, name in RULES]


def canonical_body(printed: str) -> str:
    s = re.sub(r"\s+", " ", (printed or "").replace("‐", "-")).strip()
    for rx, name in _COMPILED:
        if rx.search(s):
            return name
    return s or "Public body not named"
