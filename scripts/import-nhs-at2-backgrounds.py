#!/usr/bin/env python3
"""Fail-closed NHS OS new-background handoff; dry-run by default.

This script NEVER activates CSS, changes a database, merges, deploys, or publishes.
It imports eight opt-in WebP derivatives into a separately reviewed draft branch.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs/design/nhs-at2-assets.json"
BRANCH = "design/nhs-at2-background-handoff-20261117"

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Exact NHS_OS_Atelier_8_Full_Frame_2026-11-17.zip")
    parser.add_argument("--apply", action="store_true", help="Write vetted WebP assets on the designated draft branch only")
    args = parser.parse_args()

    approved = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    archive_bytes = args.archive.read_bytes()
    if sha(archive_bytes) != approved["zip_sha256"]:
        raise SystemExit("STOP: archive checksum mismatch; no files changed")
    files = approved["assets"]
    assert len(files) == 8 and len({a["file"] for a in files}) == 8
    dest_dir = ROOT / "public/visuals"
    with zipfile.ZipFile(args.archive) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        expected = {"manifest.json", "README.md", "preview/index.html"}
        expected.update("app/" + a["file"] for a in files)
        expected.update("sources/" + str(a["id"]).zfill(2) + "-" + a["source"] for a in files)
        if len(names) != len(set(names)) or set(names) != expected:
            raise SystemExit("STOP: unexpected, duplicated or missing archive members")
        if any(entry.is_dir() or stat.S_ISLNK(entry.external_attr >> 16) for entry in entries):
            raise SystemExit("STOP: directory or symlink archive entries not accepted")
        package_manifest = json.loads(archive.read("manifest.json"))
        if len(package_manifest.get("items", [])) != 8:
            raise SystemExit("STOP: package manifest is incomplete")
        for a in files:
            entry = next((i for i in package_manifest["items"] if i["id"] == a["id"]), None)
            if not entry or entry["webp_file"] != "app/" + a["file"] or entry["webp_sha256"] != a["sha256"]:
                raise SystemExit("STOP: archive mapping does not match pinned GitHub manifest")
            original_name = "sources/" + str(a["id"]).zfill(2) + "-" + a["source"]
            source_entry = package_manifest["items"][a["id"]-1]
            original_data = archive.read(original_name)
            if (source_entry.get("source_file") != a["source"] or
                len(original_data) != source_entry.get("source_bytes") or
                sha(original_data) != source_entry.get("source_sha256")):
                raise SystemExit("STOP: original image changed: " + a["source"])
            binary = archive.read("app/" + a["file"])
            if len(binary) != a["bytes"] or sha(binary) != a["sha256"]:
                raise SystemExit("STOP: image size/checksum mismatch: " + a["file"])
            target = dest_dir / a["file"]
            if target.exists() and sha(target.read_bytes()) != a["sha256"]:
                raise SystemExit("STOP: existing destination differs: " + str(target))
        if not args.apply:
            print("DRY RUN PASS: exact archive and 8 app images verified; no files written")
            return
        try:
            current = subprocess.check_output(["git", "branch", "--show-current"], cwd=ROOT, text=True).strip()
        except (OSError, subprocess.CalledProcessError) as exc:
            raise SystemExit("STOP: cannot verify Git branch") from exc
        if current != BRANCH:
            raise SystemExit("STOP: --apply requires draft branch " + BRANCH)
        dest_dir.mkdir(parents=True, exist_ok=True)
        for a in files:
            target = dest_dir / a["file"]
            if target.exists():
                print("Already verified:", target.relative_to(ROOT))
                continue
            binary = archive.read("app/" + a["file"])
            fd, tmp = tempfile.mkstemp(prefix=".nhs-at2-", dir=dest_dir)
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(binary)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, target)
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)
            print("Imported (not committed):", target.relative_to(ROOT))
    print("DONE: eight files staged locally; no CSS activation, commit or deployment occurred")

if __name__ == "__main__":
    main()
