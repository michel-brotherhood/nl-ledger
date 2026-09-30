-- Notes from the feedback box (routes/feedback.js). Applied once with `./notes.sh setup`; safe to run again.
-- The weekly search-index sync (pipeline/d1_sync.py) reads and writes only `docs` and `meta`.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL,            -- UTC, ISO 8601
  kind TEXT NOT NULL DEFAULT '',    -- wrong, idea, confused, question, or empty
  page TEXT NOT NULL DEFAULT '',    -- the path the note was sent from
  note TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',   -- only when the visitor left one for a reply
  checked TEXT NOT NULL,            -- how the sender was checked: turnstile or confirm
  nonce TEXT NOT NULL UNIQUE,       -- one note per check, so a repeated send stores once
  mail TEXT NOT NULL DEFAULT '',    -- what the mail system said: "sent <id>" or "failed: ..."
  done TEXT NOT NULL DEFAULT ''     -- set by `./notes.sh done <id>`: the date it was dealt with
);
CREATE INDEX IF NOT EXISTS feedback_created ON feedback (created);
-- How many notes a network address has sent in a day, under a keyed one-way code of the address (never the
-- address itself). Counts more than a day old are deleted whenever a note arrives.
CREATE TABLE IF NOT EXISTS feedback_seen (k TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, day));
