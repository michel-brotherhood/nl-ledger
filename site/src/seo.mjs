// Search-engine helpers: titles, descriptions and structured data (JSON-LD) shared by the page builders.
import { SITE, fit } from "../lib/format.mjs";

// Licences of the sources. The site's code is MIT; the data stays under each publisher's licence (README).
export const LICENSE = {
  provincial: "https://www.gov.nl.ca/disclaimer/",
  assembly: "https://www.assembly.nl.ca/CopyrightPrivacyStatement.aspx",
  federal: "https://open.canada.ca/en/open-government-licence-canada",
};

export const ORG = { "@type": "Organization", name: SITE.name, url: SITE.url, logo: `${SITE.url}/nl-ledger-icon-256.png` };

// Keep a name inside a title budget without cutting a word in half.
export function clip(s, n) {
  s = String(s || "");
  return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

// A share-card description: whole sentences, at most 155 characters, no ellipsis.
export const desc = (s) => fit(s, 155);

export function siteLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      alternateName: "nlledger",
      url: `${SITE.url}/`,
      description: SITE.tagline,
      inLanguage: "en-CA",
      publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search/?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
    { "@context": "https://schema.org", ...ORG, description: "An independent project that gathers Newfoundland and Labrador public spending records in one searchable place, each linked to its source." },
  ];
}

// A Dataset. `files` are the site's own JSON files; `license` is the publisher's licence URL or a list of them.
export function datasetLd({ name, description, path, license, period, files = [], publishers = [] }) {
  const d = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url: `${SITE.url}${path}`,
    inLanguage: "en-CA",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE.name, url: SITE.url },
    spatialCoverage: "Newfoundland and Labrador, Canada",
    license,
  };
  if (period) d.temporalCoverage = period;
  if (publishers.length) d.isBasedOn = publishers.map((p) => ({ "@type": "Dataset", name: p.name, url: p.url }));
  if (files.length) d.distribution = files.map((f) => ({ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE.url}${f}` }));
  return d;
}

// A Person, only for people the source publishes by name in their public role (an MHA or a minister).
export function personLd({ name, path, jobTitle, description }) {
  return { "@context": "https://schema.org", "@type": "Person", name, url: `${SITE.url}${path}`, jobTitle, description, worksFor: { "@type": "GovernmentOrganization", name: "Government of Newfoundland and Labrador" } };
}

export function orgPageLd({ name, path, description }) {
  return { "@context": "https://schema.org", "@type": "Organization", name, url: `${SITE.url}${path}`, description };
}
