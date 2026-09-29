CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
  body, tags,
  doc_id UNINDEXED, dataset UNINDEXED, title UNINDEXED, buyer UNINDEXED, total UNINDEXED, n UNINDEXED,
  date_min UNINDEXED, date_max UNINDEXED, h UNINDEXED, items UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2', columnsize = 0
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
