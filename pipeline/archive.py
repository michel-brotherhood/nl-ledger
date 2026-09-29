"""Archive every downloaded source file to S3-compatible storage (Garage on the home server).

Each version of each file is kept once, under its cache path, fetch date and hash:

    <cache path>/<YYYY-MM-DD>_<sha256 first 16>[.gz]

for example `ppa/Contract-Awards-June-2025.pdf/2026-09-29_3fa1c2d4e5b6a7c8`. Text formats are
gzipped (Content-Encoding: gzip); PDFs, spreadsheets and zips are stored as they are. Object
metadata carries the government URL, the full sha256 and the fetch time, so any figure can be
traced to the exact file it came from even after the publisher changes or removes it. The
site's receipt links still point at the government's own URL (manifest.json is unchanged).

A copy of manifest.json is kept per run under `_manifests/`.

Settings (environment): NL_LEDGER_S3_ENDPOINT, NL_LEDGER_S3_BUCKET, NL_LEDGER_S3_REGION,
NL_LEDGER_S3_KEY_ID, NL_LEDGER_S3_SECRET. Without them the archive is skipped with a message,
unless NL_LEDGER_ARCHIVE_REQUIRED=1 (the weekly job), which makes that an error.

Usage: uv run python archive.py            upload files not yet archived
       uv run python archive.py --verify N  download N random archived files and check their hashes
"""
import gzip
import hashlib
import io
import json
import os
import random
import sys
from datetime import datetime, timezone

from common import CACHE, load_manifest, sha256

GZIP_SUFFIXES = {".csv", ".jsonl", ".json", ".html", ".htm", ".txt"}
SETTINGS = ["NL_LEDGER_S3_ENDPOINT", "NL_LEDGER_S3_BUCKET", "NL_LEDGER_S3_KEY_ID", "NL_LEDGER_S3_SECRET"]


def client():
    missing = [k for k in SETTINGS if not os.environ.get(k)]
    if missing:
        if os.environ.get("NL_LEDGER_ARCHIVE_REQUIRED") == "1":
            sys.exit(f"archive: {', '.join(missing)} not set")
        print(f"archive: skipped ({', '.join(missing)} not set)")
        return None, None
    import boto3
    from botocore.config import Config
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["NL_LEDGER_S3_ENDPOINT"],
        region_name=os.environ.get("NL_LEDGER_S3_REGION", "garage"),
        aws_access_key_id=os.environ["NL_LEDGER_S3_KEY_ID"],
        aws_secret_access_key=os.environ["NL_LEDGER_S3_SECRET"],
        config=Config(s3={"addressing_style": "path"}, retries={"max_attempts": 5, "mode": "standard"}),
    )
    return s3, os.environ["NL_LEDGER_S3_BUCKET"]


def archived(s3, bucket) -> dict:
    """{cache path: {sha256 prefix: key}} for everything already in the bucket."""
    out: dict = {}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket):
        for o in page.get("Contents", []):
            key = o["Key"]
            if key.startswith("_"):
                continue
            rel, _, name = key.rpartition("/")
            sha16 = name.split("_", 1)[-1].split(".", 1)[0]
            out.setdefault(rel, {})[sha16] = key
    return out


def upload() -> None:
    s3, bucket = client()
    if not s3:
        return
    have = archived(s3, bucket)
    manifest = load_manifest()
    sent = skipped = 0
    size = 0
    for rel, entry in sorted(manifest.items()):
        path = CACHE / rel
        if not path.exists():
            continue
        digest = sha256(path)
        if entry.get("sha256") and entry["sha256"] != digest:
            sys.exit(f"archive: {rel} does not match the sha256 in manifest.json; the cache is inconsistent")
        if digest[:16] in have.get(rel, {}):
            skipped += 1
            continue
        fetched = entry.get("fetched_at") or datetime.now(timezone.utc).isoformat(timespec="seconds")
        body = path.read_bytes()
        extra = {}
        key = f"{rel}/{fetched[:10]}_{digest[:16]}"
        if path.suffix.lower() in GZIP_SUFFIXES:
            body = gzip.compress(body, compresslevel=6, mtime=0)
            key += ".gz"
            extra["ContentEncoding"] = "gzip"
        s3.put_object(
            Bucket=bucket, Key=key, Body=body, **extra,
            Metadata={"source-url": entry.get("url", ""), "sha256": digest, "fetched-at": fetched},
        )
        head = s3.head_object(Bucket=bucket, Key=key)
        if head["ContentLength"] != len(body):
            sys.exit(f"archive: {key} stored {head['ContentLength']} bytes, sent {len(body)}")
        sent += 1
        size += len(body)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    s3.put_object(Bucket=bucket, Key=f"_manifests/{stamp}.json.gz", ContentEncoding="gzip",
                  Body=gzip.compress(json.dumps(manifest, indent=1, sort_keys=True).encode(), mtime=0))
    print(f"archive: {sent} new file versions ({size / 1e6:,.1f} MB stored), {skipped} already archived; manifest copy _manifests/{stamp}.json.gz")


def verify(n: int) -> None:
    """Fetch n random archived files back and check them against their recorded sha256."""
    s3, bucket = client()
    if not s3:
        return
    keys = [k for files in archived(s3, bucket).values() for k in files.values()]
    if not keys:
        sys.exit("archive verify: the bucket holds no archived files")
    for key in random.sample(keys, min(n, len(keys))):
        obj = s3.get_object(Bucket=bucket, Key=key)
        body = obj["Body"].read()
        if key.endswith(".gz"):
            body = gzip.GzipFile(fileobj=io.BytesIO(body)).read()
        want = obj["Metadata"].get("sha256", "")
        got = hashlib.sha256(body).hexdigest()
        if got != want:
            sys.exit(f"archive verify: {key} sha256 {got[:16]} does not match recorded {want[:16]}")
        print(f"archive verify: {key} fetched back, {len(body):,} bytes, sha256 matches ({got[:16]})")


if __name__ == "__main__":
    if "--verify" in sys.argv:
        verify(int(sys.argv[sys.argv.index("--verify") + 1]))
    else:
        upload()
