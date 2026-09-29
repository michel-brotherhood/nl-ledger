# Contributing to NL Ledger

NL Ledger is built from public records, and anyone can help make it more accurate and more complete. No programming is needed for most of what helps. If you have never opened a pull request, an issue with a link and a sentence is a full contribution, and a maintainer will take it from there.

People who use an AI assistant to prepare a change are equally welcome. The same standard applies to every change: it links to its source and its totals match.

## Ways in

| You want to | Open |
|---|---|
| Add a source of public spending records | The **Add a source** issue form |
| Question how something is counted, flagged or worded | The **Challenge a method** issue form |
| Report a figure that does not match its source | The **Figure does not match its source** issue form |
| Ask for records that are not published anywhere | The **Request unpublished data** issue form |

All four are at [Issues, New issue](https://github.com/steveclarke/nl-ledger/issues/new/choose). Sources already known but not yet loaded are in [`docs/wishlist.md`](docs/wishlist.md); check there first, and pick one up if it interests you.

## What a good contribution includes

- **A source link for every figure.** Each new record links to the file and the page or row it came from. A reader should reach the original in one click.
- **Totals that reconcile.** Where the source prints a total, the parsed lines add up to it. Where it prints none, say so and show another check, such as a row count per report or a hand-traced sample.
- **A plain description of what is counted.** Say what each row is (an award, a payment, a claim), which dates it uses, and what is left out.
- **The publisher's licence.** Note the terms the source is published under, so the README's licence section stays accurate.
- **Neutral wording.** The site states what the records say. It does not accuse. A pattern is a question people ask, with its method written down.

For a method challenge or a mismatch report, the same rule applies in reverse: link the source and the page on the site, and describe what differs.

## Checks on every pull request

Two checks run on each pull request (`.github/workflows/checks.yml`):

- **Guardrails.** `site/check.sh` scans the site code for the maintainer's name: the site presents the records, not the people who run it. Run after a local build, it also scans the built pages for that name, for an author meta tag and for accusation words such as "waste" or "corrupt" outside the quoted records. The first two fail the check; the third prints for a reviewer to judge. CI has no built pages, so it runs only the code scan.
- **Syntax.** Every script in `pipeline/` and every module in `site/` must parse.

To see your change on a running site, `./dev.sh` from a fresh clone needs only Node 22.13 or newer. It loads a small sample of the records, so no download or account is involved (see the [README](README.md#run-it-locally)).

These checks cannot run the full pipeline. Doing so downloads every source, including federal files of several hundred megabytes, and takes minutes. That means CI does not check reconciliation or the built pages. Run them yourself before opening a pull request that touches data or the site:

```sh
cd pipeline && ./run.sh        # fetch, parse, reconcile
cd ../site && node build.mjs && ./check.sh
```

`run.sh` rewrites `docs/reconciliation.md`. Include the updated file in the pull request, and describe any total that no longer matches its source. Setup details are in the [README](README.md#run-it-locally).

## Every pull request gets a review

A maintainer reviews every pull request, however small. The review looks at the source links, the reconciliation and the wording, and asks questions rather than rejecting. A change that needs more work stays open with a note on what would settle it.

## Making a change

1. Fork the repository and create a branch.
2. Make the change. For a new source, add its fetch and parse scripts in `pipeline/` and its entry in `docs/sources.md`.
3. Run the local steps above. `./dev.sh` is the quickest way to look at the result.
4. Open a pull request and fill in the template.

If you would rather not do these steps, open an issue with what you found and where. That is enough.

## Conduct

Keep discussion about the records and the method. Do not use issues to accuse named people; the site shows what the public records say and nothing more. Comments that do will be edited or removed.
