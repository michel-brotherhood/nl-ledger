// Spelling help for search: a word no record contains is replaced by the closest word that
// records do contain ("Memorail" → "memorial", "Stantek" → "stantec").
//
// The vocabulary is every word of three letters or more in the search documents, with the
// number of documents holding it (build.mjs writes it to /data/words.json from docs.jsonl).
// Search matches the start of words, so a word is known when any vocabulary word starts with it.

// Vocabulary as built: { w: [sorted words], n: [document counts, same order] }.
export function known(vocab, word) {
  const ws = vocab.w;
  let lo = 0, hi = ws.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ws[mid] < word) lo = mid + 1;
    else hi = mid;
  }
  return lo < ws.length && ws[lo].startsWith(word);
}

// Edit distance counting a swap of two neighbouring letters as one edit; gives up above max.
export function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

// The closest known word, or null. Short words are left alone: at three letters nearly
// everything is one edit from something.
export function closest(vocab, word) {
  if (word.length < 4 || /\d/.test(word)) return null;
  const max = word.length <= 5 ? 1 : 2;
  let best = null, bestD = max + 1, bestN = 0;
  const { w, n } = vocab;
  for (let i = 0; i < w.length; i++) {
    const cand = w[i];
    if (Math.abs(cand.length - word.length) > max) continue;
    const d = distance(word, cand, Math.min(max, bestD));
    if (d < bestD || (d === bestD && n[i] > bestN)) {
      best = cand; bestD = d; bestN = n[i];
    }
  }
  return bestD <= max ? best : null;
}

// Each unknown word of the query replaced by its closest known word. Returns null when
// nothing changed, else { q, fixed: [[from, to], ...] }.
export function correct(vocab, qwords) {
  const fixed = [];
  const out = qwords.map((w) => {
    if (known(vocab, w)) return w;
    const c = closest(vocab, w);
    if (c) fixed.push([w, c]);
    return c || w;
  });
  return fixed.length ? { q: out.join(" "), fixed } : null;
}

// Build the vocabulary from search document bodies (build.mjs). `words` is search.mjs's tokenizer.
export function buildVocab(bodies, words) {
  const df = new Map();
  for (const body of bodies) {
    for (const w of new Set(words(body))) {
      if (w.length < 3 || /\d/.test(w)) continue;
      df.set(w, (df.get(w) || 0) + 1);
    }
  }
  const w = [...df.keys()].sort();
  return { w, n: w.map((x) => df.get(x)) };
}
