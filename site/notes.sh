#!/usr/bin/env bash
# Notes from the feedback box, read from the live D1 table `feedback` with the `cf` login (NOTES.md "Feedback box").
#   ./notes.sh              the 20 newest notes
#   ./notes.sh 100          the 100 newest
#   ./notes.sh done 12      mark note 12 as dealt with
#   ./notes.sh delete 12    delete note 12
#   ./notes.sh setup        create the table (once; safe to repeat)
set -euo pipefail
cd "$(dirname "$0")"
setting() { local v="${!1:-}"; [ -n "$v" ] || v=$(sed -n "s/^$1=//p" .env 2>/dev/null); [ -n "$v" ] || { echo "$1 is not set; add it to site/.env (see .env.example)" >&2; exit 1; }; echo "$v"; }
export CLOUDFLARE_ACCOUNT_ID="$(setting CLOUDFLARE_ACCOUNT_ID)"
DB="$(setting NL_LEDGER_D1_ID)"
cf="$(command -v cf || echo ./node_modules/.bin/cf)"
id() { [[ "${1:-}" =~ ^[0-9]+$ ]] || { echo "give the note's number" >&2; exit 1; }; echo "$1"; }
case "${1:-}" in
  setup) "$cf" d1 query "$DB" --sql "$(grep -v '^--' feedback.sql | sed 's/--.*//' | tr '\n' ' ')" ;;
  done) "$cf" d1 query "$DB" --sql "UPDATE feedback SET done = date('now') WHERE id = $(id "${2:-}")" ;;
  delete) "$cf" d1 query "$DB" --sql "DELETE FROM feedback WHERE id = $(id "${2:-}")" ;;
  "" | *[0-9])
    "$cf" d1 query "$DB" --sql "SELECT id, created, kind, page, note, email, checked, mail, done FROM feedback ORDER BY id DESC LIMIT $(id "${1:-20}")" |
      node -e 'const rows = JSON.parse(require("fs").readFileSync(0, "utf8")).flatMap((x) => x.results || []);
        for (const r of rows) console.log(`#${r.id}  ${r.created.slice(0, 16).replace("T", " ")} UTC  ${r.kind || "no kind"}  ${r.page || "no page"}${r.done ? `  [done ${r.done}]` : ""}\n    reply to: ${r.email || "no address"}   checked by: ${r.checked}   mail: ${r.mail || "pending"}\n${r.note.replace(/^/gm, "    | ")}\n`);
        console.log(`${rows.length} ${rows.length === 1 ? "note" : "notes"}`);' ;;
  *) sed -n '2,7p' "$0" ;;
esac
