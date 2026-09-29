---
name: NL Ledger
description: The province's Estimates book, turned toward the citizen. Every figure has a receipt.
colors:
  bond-paper: "#fcfcfa"
  bond-paper-shade: "#f1f2ef"
  bond-paper-deep: "#e6e8e4"
  accounting-ink: "#14171a"
  ink-secondary: "#454b52"
  ink-muted: "#676d74"
  hairline: "#d3d6d1"
  estimates-blue: "#1f3c96"
  estimates-blue-deep: "#172e76"
  on-blue: "#ffffff"
  on-blue-secondary: "#cdd7f5"
  link-blue: "#1f3c96"
  flag-gold: "#f0b323"
  on-gold: "#1a1406"
  red-ink: "#b3261e"
  graphite: "#59606a"
  bar-blue: "#2f57c4"
  bar-ghost: "#c3cadb"
  level-provincial: "#2f57c4"
  level-federal: "#c2601a"
  level-municipal: "#1b9e77"
  night-paper: "#0f1215"
  night-ink: "#eceeea"
typography:
  cover-figure:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(4rem, 17vw, 9.5rem)"
    fontWeight: 850
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 68"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 5.6vw, 3.4rem)"
    fontWeight: 850
    lineHeight: 1.02
    letterSpacing: "0.012em"
    fontVariation: "'wdth' 72"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3.2vw, 2.1rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "0.012em"
    fontVariation: "'wdth' 72"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 800
    letterSpacing: "0.07em"
    fontVariation: "'wdth' 78"
  figures:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.975rem"
    fontFeature: "'tnum' 1, 'lnum' 1"
rounded:
  none: "0px"
  control: "4px"
  pill: "999px"
spacing:
  gutter: "clamp(1rem, 4vw, 2.5rem)"
  section: "clamp(3rem, 7vw, 5.5rem)"
  measure: "68ch"
  container: "76rem"
components:
  button-primary:
    backgroundColor: "{colors.estimates-blue}"
    textColor: "{colors.on-blue}"
    rounded: "{rounded.control}"
    padding: "0.55rem 1.05rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.estimates-blue-deep}"
  button-on-cover:
    backgroundColor: "{colors.accounting-ink}"
    textColor: "{colors.bond-paper}"
  field:
    backgroundColor: "{colors.bond-paper}"
    textColor: "{colors.accounting-ink}"
    rounded: "{rounded.control}"
    height: "3.1rem"
  one-to-one-callout:
    backgroundColor: "{colors.flag-gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.none}"
    padding: "1.1rem 1.2rem 1.1rem 4.2rem"
  chip:
    backgroundColor: "{colors.bond-paper}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.65rem"
---

# Design System: NL Ledger

## Overview

**Creative North Star: "The Citizen's Estimates Book"**

The site is set like the Estimates and Public Accounts volumes the Department of Finance prints: bold condensed caps for heads, figures in ruled columns, a single rule under subtotals and a double rule under totals, and notes that say where every number came from. It turns that apparatus around to answer a resident's questions: what is my share, what did it buy, where is the receipt.

It is paper and ink, not a dashboard. There are no floating cards, gradients or KPI tiles. Colour is used at page scale: the drenched Estimates blue owns covers and section openers, flag gold appears only where one real purchase is pulled out at true proportion, red ink appears only on negative figures, and graphite marks a pattern as a question.

**Key Characteristics:**
- Drenched blue covers open the home page and every section, with a double rule at the spine.
- Schedules (ruled tables) carry every figure, with row-level receipts ("p. 12").
- Dot-leader lists replace stat tiles.
- One gold 1:1 call-out per real purchase, measured against a named aggregate.
- Footnote receipts collected in a Notes section at the foot of each page.

## Colors

- **Estimates Blue** (`#1f3c96`): covers, masthead, section openers, primary buttons and links. Used as a field, not a trim.
- **Bond Paper** (`#fcfcfa`) and **Accounting Ink** (`#14171a`): the page. Neutral, not cream.
- **Flag Gold** (`#f0b323`): the 1:1 call-out only.
- **Red Ink** (`#b3261e`): negative figures, in parentheses.
- **Graphite** (`#59606a`): query marks for flagged items and receipt links.
- **Bar Blue** and **Bar Ghost**: actual against estimate in bar pairs.
- **Level colours** (provincial blue, federal burnt orange, municipal green): validated for colour-blind separation in light and dark; always paired with a text label.

**The Gold Is Earned Rule.** Gold appears only on a 1:1 call-out. Buttons, figures and rules never borrow it.

**The Red Is Negative Rule.** Red marks a negative figure and nothing else. Flags are graphite, never red.

Dark mode is its own set of steps (night paper `#0f1215`, night ink `#eceeea`, lighter bar and link blues), selected by the reader's system setting or the masthead toggle. Checked 2026-09-29 on every page type, phone and desktop: text meets WCAG AA (4.5:1, 3:1 for large text) in both schemes. The dark "estimate" bar is `#5b6575` (3.2:1 on night paper) so it reads as a graphic, not just a tint. The blue band keeps a light main button in both schemes. The favicon is a blue tile with white letters (readable on any tab colour); the SVG favicon switches to light blue letters in a dark browser.

## Typography

One family, Archivo (variable, self-hosted), on its width axis:
- Heads: uppercase, width 70 to 72, weight 800 to 850.
- Prose: width 100, weight 400, 1.0625rem on 1.55, measure 68ch.
- Labels: uppercase, width 78, weight 800, tracked 0.07em.
- Figures in columns: tabular lining numerals. Standalone display figures stay proportional.

**The One Family Rule.** No second face. Hierarchy comes from width, weight and case.

## Layout

- Container 76rem with a gutter of `clamp(1rem, 4vw, 2.5rem)`; sections breathe at `clamp(3rem, 7vw, 5.5rem)`.
- Two-column grid from 60rem (`1.15fr / 1fr`); a single column below.
- Wide schedules scroll inside their own wrapper; the page never scrolls sideways at 375px.
- Masthead is sticky; the nav scrolls horizontally on phones.

## Elevation & Depth

Flat. Depth comes from rules and tonal paper, not shadows. Boxes (the receipt, the call-out) are framed by ink rules. The only shadow token (`--shadow`) is reserved and currently unused on components.

## Shapes

Square by default. Controls (fields, buttons) take a 4px radius; chips are pills. Bars are square at the baseline and rounded 4px at the data end.

**The Double Rule.** Totals sit on a 5px double rule, heavy enough to read as two lines at 1x.

## Components

- **Schedule table** (`.sched`): caps headers over a 1.5px ink rule, hairline rows, right-aligned tabular figures, `.sub` rows ruled above, a `tfoot` total on a double rule.
- **Leaders** (`.leaders`): label, dotted leader, figure; `.total` row ruled and double-ruled; `.big` for headline lists.
- **1:1 call-out** (`.one`): gold field with ink rules top and bottom, a boxed "1:1" tag, the amount, the item, and a meter against a named aggregate.
- **Query mark** (`.q`): a circled question mark in graphite that links to the flag's page.
- **Receipt link** (`.rcpt`): "p. N" in graphite with a dotted underline; opens the source PDF at that page.
- **Receipt** (`.receipt`): the personal tax receipt, framed in ink, department rows with thin bars, the remainder folded into "N more departments", total on a double rule.
- **Field** (`.field-row`): 1.5px ink frame, joined button at the right; on blue covers the frame and fill are paper.
- **Copy block** (`.copy`): caps label, the text in a ruled code field, a joined ink Copy button that turns to "Copied"; on phones the button sits above the field. The address on a blue cover (`.copy.inline`) is set larger on a paper field.
- **Picker** (`.picker`, `.pick`): a thumb index of assistant names in ruled caps tabs, grouped by a caps label; the chosen one is ink on paper reversed. Without JavaScript it is a list of jump links and every panel shows.
- **Client panel** (`.client`): heading, one plain line on where it works, copy block, one action button, numbered steps, and a line naming the maker's own instructions; ruled above and double-ruled below.
- **Question and answer** (`.qa`): a two-row schedule framed in ink ("Asked", then the assistant's answer with its source link), double rule at the foot, caption saying where the answer came from.
- **Fold-out** (`.fold`): the $1 billion column in blue with real amounts stacked in gold and carried-forward rules every $100 million.

## Do's and Don'ts

- Do put a receipt on every figure: a footnote to the source and page, or a row-level "p. N" link.
- Do show parts that visibly add up to their total, with a remainder row when the list is cut.
- Do write figures in words at display size ("$10.6 billion") and to the dollar in schedules.
- Do keep flags as questions: graphite marks, a caveat on every flag page, no alarm colours.
- Don't use cards, drop shadows, gradients or KPI tiles.
- Don't use gold for anything but a 1:1 call-out, or red for anything but a negative figure.
- Don't put a kicker or eyebrow above a heading.
- Don't name individuals in pattern results; count them by employer and job.
