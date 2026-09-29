"""Shared helpers: paths, cached downloads, manifest, text normalisation."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "cache"
CLEAN = ROOT / "data" / "clean"
BUILD = ROOT / "data" / "build"
MANIFEST = CACHE / "manifest.json"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)

for d in (CACHE, CLEAN, BUILD):
    d.mkdir(parents=True, exist_ok=True)

_session = requests.Session()
_session.headers["User-Agent"] = UA


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {}


def save_manifest(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, indent=1, sort_keys=True))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url: str, dest: Path, *, refresh: bool = False, manifest: dict | None = None) -> Path | None:
    """Download url to dest unless already cached. Records url, sha256, fetched_at."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    own = manifest is None
    if own:
        manifest = load_manifest()
    rel = str(dest.relative_to(CACHE))
    if dest.exists() and dest.stat().st_size > 0 and not refresh:
        if rel not in manifest:
            manifest[rel] = {"url": url, "sha256": sha256(dest), "fetched_at": _mtime(dest)}
            if own:
                save_manifest(manifest)
        return dest
    for attempt in range(3):
        try:
            r = _session.get(url, timeout=120, stream=True)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            tmp = dest.with_suffix(dest.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 16):
                    f.write(chunk)
            with open(tmp, "rb") as f:
                head = f.read(512).lstrip(b"\xef\xbb\xbf").lstrip().lower()
            if dest.suffix.lower() not in (".html", ".htm") and (head.startswith(b"<!doctype") or head.startswith(b"<html")):
                tmp.unlink()
                print(f"  NOT FOUND (HTML page served for {url})")
                return None
            tmp.rename(dest)
            manifest[rel] = {
                "url": url,
                "sha256": sha256(dest),
                "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            if own:
                save_manifest(manifest)
            return dest
        except requests.RequestException as e:
            if attempt == 2:
                print(f"  FAILED {url}: {e}")
                return None
            time.sleep(2 * (attempt + 1))
    return None


def get_text(url: str) -> str:
    r = _session.get(url, timeout=60)
    r.raise_for_status()
    return r.text


def _mtime(p: Path) -> str:
    return datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat(timespec="seconds")


def source_url(rel: str) -> str:
    """Original URL of a cached file (receipt link)."""
    return load_manifest().get(rel, {}).get("url", "")


def pdftotext(path: Path, layout: bool = True, page: int | None = None) -> str:
    args = ["pdftotext"]
    if layout:
        args.append("-layout")
    if page:
        args += ["-f", str(page), "-l", str(page)]
    args += [str(path), "-"]
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def pdf_pages(path: Path) -> list[str]:
    """Text per page (layout mode). Pages split on form feed."""
    txt = pdftotext(path)
    pages = txt.split("\f")
    if pages and not pages[-1].strip():
        pages = pages[:-1]
    return pages


def norm_space(s: str | None) -> str:
    import html
    return re.sub(r"\s+", " ", html.unescape(s or "")).strip()


_SUFFIX = re.compile(
    r"\b(incorporated|inc|ltd|limited|corp|corporation|co|company|llc|lp|llp|plc|ulc|"
    r"ltee|ltée|l\.?t\.?d|the)\b\.?",
    re.I,
)


def entity_key(name: str | None) -> str:
    """Normalised supplier/recipient key for matching across sources.

    Lower-case, accents stripped, punctuation and legal suffixes removed.
    Deliberately conservative: it never merges names that differ in words.
    """
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = _SUFFIX.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def key_hash(s: str, n: int = 10) -> str:
    return hashlib.sha1(s.encode()).hexdigest()[:n]


def money(s: str | float | int | None) -> float | None:
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    t = s.strip().replace("$", "").replace(",", "").replace(" ", "")
    neg = t.startswith("(") and t.endswith(")")
    t = t.strip("()")
    if t in ("", "-", "—"):
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v
