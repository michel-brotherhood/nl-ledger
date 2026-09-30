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
case "${1:-}" in
  setup) "$cf" d1 query "$DB" --sql "$(grep -v '^--' feedback.sql | sed 's/--.*//' | tr '\n' ' ')" ;;
  done | delete)
    [[ "${2:-}" =~ ^[0-9]+$ ]] || { echo "give the note's number: ./notes.sh $1 12" >&2; exit 1; }
    if [ "$1" = done ]; then sql="UPDATE feedback SET done = date('now') WHERE id = $2"; else sql="DELETE FROM feedback WHERE id = $2"; fi
    "$cf" d1 query "$DB" --sql "$sql" ;;
  "" | *[0-9])
    n="${1:-20}"
    [[ "$n" =~ ^[0-9]+$ ]] || { echo "give a number of notes: ./notes.sh 50" >&2; exit 1; }
    "$cf" d1 query "$DB" --sql "SELECT id, created, kind, page, note, email, checked, mail, done FROM feedback ORDER BY id DESC LIMIT $n; SELECT count(*) unsent FROM feedback WHERE mail NOT LIKE 'sent%'" |
      node -e 'const out = JSON.parse(require("fs").readFileSync(0, "utf8"));
        const rows = out[0]?.results || [];
        // Visitor text goes to a terminal: control and direction characters are dropped (a note keeps its line breaks).
        const c = (s, keep) => String(s ?? "").replace(keep ? /[\u0000-\u0009\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/g : /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, "");
        for (const r of rows) console.log(`#${r.id}  ${r.created.slice(0, 16).replace("T", " ")} UTC  ${r.kind || "no kind"}  ${c(r.page) || "no page"}${r.done ? `  [done ${r.done}]` : ""}\n    reply to: ${c(r.email) || "no address"}   checked by: ${r.checked}   mail: ${c(r.mail) || "pending"}\n${c(r.note, true).replace(/^/gm, "    | ")}\n`);
        const unsent = out[1]?.results?.[0]?.unsent || 0;
        console.log(`${rows.length} ${rows.length === 1 ? "note" : "notes"}${unsent ? `; ${unsent} in the table with no email sent (mail failed or is pending)` : ""}`);' ;;
  *) sed -n '2,7p' "$0" ;;
esac
