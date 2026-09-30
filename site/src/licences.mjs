// The licence or terms each source is published under, taken from the publisher's own page (checked 2026-09-29).
// `wording` is the attribution the licence asks for, quoted exactly; `note` says what the terms allow when there is no open licence.
export const LICENCES = {
  ogl: {
    name: "Open Government Licence – Canada",
    url: "https://open.canada.ca/en/open-government-licence-canada",
    wording: "Contains information licensed under the Open Government Licence – Canada.",
  },
  nl: {
    name: "Government of Newfoundland and Labrador, copyright notice",
    url: "https://www.gov.nl.ca/disclaimer/",
    note: "No open licence is stated for these records. The province's notice grants the public and non-government organizations permission to use the information on its website.",
  },
  hoa: {
    name: "House of Assembly, Copyright & Privacy Statement",
    url: "https://www.assembly.nl.ca/CopyrightPrivacyStatement.aspx",
    note: "No open licence. The Speaker permits excerpts and citation for purposes such as research, criticism and journalistic fair comment, and asks that copies acknowledge the source. Commercial use needs the Speaker's written approval.",
  },
  paradise: {
    name: "Town of Paradise, Terms and Conditions",
    url: "https://www.paradise.ca/terms-and-conditions/",
    note: "No open licence. The town allows content to be copied for personal, educational or other non-commercial purposes only; any other use needs its prior written permission.",
  },
  stjohns: {
    name: "City of St. John's, Terms and Conditions of Use",
    url: "https://www.stjohns.ca/terms-and-conditions-of-use/",
    note: "No licence stated. The City's notice reads \"Copyright © the City of St. John's (unless otherwise indicated). All rights reserved.\"",
  },
  statcan: {
    name: "Statistics Canada Open Licence",
    url: "https://www.statcan.gc.ca/en/reference/licence",
    wording: "Adapted from Statistics Canada, name of product, reference date. This does not constitute an endorsement by Statistics Canada of this product.",
  },
  gc: {
    name: "Government of Canada, Terms and conditions",
    url: "https://www.canada.ca/en/transparency/terms.html",
    note: "Non-commercial reproduction is allowed without further permission if the title and author are given and the copy says where the original is. Commercial redistribution needs written permission.",
  },
};

// Which licence each budget and accounts document falls under (site/src/budgetdata.mjs, DOCS): all four are
// published on gov.nl.ca under the province's copyright notice (read 2026-09-30).
export const DOCUMENT_LICENCE = { report: "nl", estimates: "nl", statements: "nl", public_accounts: "nl" };

// Which licence each line-item source (ds) falls under.
export const SOURCE_LICENCE = {
  ppa: "nl", minister: "nl", sunshine: "nl", mha: "hoa",
  fed_contract: "ogl", fed_grant: "ogl", canadabuys: "ogl", pa_pss: "ogl", pa_tp: "ogl",
  paradise: "paradise", stjohns: "stjohns",
};
