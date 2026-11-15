#!/usr/bin/env python3
"""Import only the two owner-approved NHS Living Atelier WebP files.

Dry run by default. This is a LOCAL file handoff helper, not a GitHub upload,
CI deployment, database migration, or invitation to alter production.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import stat
import tempfile
import zipfile

APPROVED_ZIP_SHA256 = "23f7482faf09c015a140a53ed6335d1fafb029a9919d00505262557545758e0f"
APPROVED_MANIFEST_SHA256 = "0f4e8893555f8a7ddf91169ce1ae3cef341e184e87099bf3089d9e2e3cba5561"

@dataclass(frozen=True)
class ApprovedAsset:
    filename: str
    target: str
    size: int
    sha256: str

ASSETS = (
    ApprovedAsset(
        "nhs-living-atelier-observatory.webp",
        "public/visuals/nhs-living-atelier-observatory.webp",
        138064,
        "e5130cae5a1a8d30e6b2c0a09cd59d6350a36f278240f5f55480fc850a0c0284",
    ),
    ApprovedAsset(
        "nhs-living-atelier-client-sanctuary.webp",
        "public/visuals/nhs-living-atelier-client-sanctuary.webp",
        151750,
        "b0b259d26af5ac7d8ff07dbdc1c65fb5b517ad6856b8f9ec74ff1d10182ed9d6",
    ),
)

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def load_approved_zip(
    zip_path: Path,
    assets: tuple[ApprovedAsset, ...] = ASSETS,
    zip_sha256: str = APPROVED_ZIP_SHA256,
    manifest_sha256: str = APPROVED_MANIFEST_SHA256,
) -> dict[str, bytes]:
    raw_zip = zip_path.read_bytes()
    if digest(raw_zip) != zip_sha256:
        raise ValueError("STOP: ZIP differs from the approved NHS asset package")
    with zipfile.ZipFile(zip_path) as archive:
        allowed = {asset.filename for asset in assets} | {"manifest.json"}
        members = archive.infolist()
        names = [member.filename for member in members]
        if len(names) != len(allowed) or set(names) != allowed:
            raise ValueError("STOP: ZIP contains missing, duplicated, or unexpected paths")
        for member in members:
            if member.is_dir() or stat.S_ISLNK(member.external_attr >> 16):
                raise ValueError("STOP: folders or symlinks in an image-only ZIP are forbidden")
            if member.file_size > 400_000:
                raise ValueError("STOP: oversized image or manifest in ZIP")
        if digest(archive.read("manifest.json")) != manifest_sha256:
            raise ValueError("STOP: the approved asset manifest was altered")
        images: dict[str, bytes] = {}
        for asset in assets:
            data = archive.read(asset.filename)
            if len(data) != asset.size or digest(data) != asset.sha256:
                raise ValueError(f"STOP: image bytes were changed: {asset.filename}")
            if not (data[:4] == b"RIFF" and data[8:12] == b"WEBP"):
                raise ValueError(f"STOP: image is not a WebP: {asset.filename}")
            images[asset.filename] = data
        return images

def check_destination(
    root: Path,
    images: dict[str, bytes],
    assets: tuple[ApprovedAsset, ...] = ASSETS,
) -> list[tuple[Path, bytes]]:
    root = root.resolve()
    planned: list[tuple[Path, bytes]] = []
    for asset in assets:
        dest = root / asset.target
        if not dest.resolve().is_relative_to(root):
            raise ValueError(f"STOP: image target escapes the checked-out repository: {asset.target}")
        if dest.is_symlink():
            raise ValueError(f"STOP: image destination is a symbolic link: {asset.target}")
        data = images[asset.filename]
        if dest.exists():
            if digest(dest.read_bytes()) != asset.sha256:
                raise ValueError(f"STOP: existing image differs; refusing overwrite: {asset.target}")
        else:
            planned.append((dest, data))
    return planned

def apply_images(planned: list[tuple[Path, bytes]]) -> None:
    # Called only after every archive and existing destination passed preflight.
    for dest, data in planned:
        dest.parent.mkdir(parents=True, exist_ok=True)
        temp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(dir=dest.parent, delete=False) as handle:
                temp_path = Path(handle.name)
                handle.write(data)
            if dest.exists():
                raise ValueError(f"STOP: a destination appeared during import: {dest}")
            os.replace(temp_path, dest)
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)

def self_test() -> None:
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        sample = b"RIFF" + (10).to_bytes(4, "little") + b"WEBP" + b"VP8 " + b"XY"
        manifest = b'{"approved":true}'
        sample_spec = (ApprovedAsset("sample.webp", "public/visuals/sample.webp", len(sample), digest(sample)),)
        zip_path = root / "sample.zip"
        with zipfile.ZipFile(zip_path, "w") as archive:
            archive.writestr("sample.webp", sample)
            archive.writestr("manifest.json", manifest)
        data = load_approved_zip(zip_path, sample_spec, digest(zip_path.read_bytes()), digest(manifest))
        planned = check_destination(root, data, sample_spec)
        if len(planned) != 1:
            raise AssertionError("valid image should be eligible for import")
        apply_images(planned)
        if (root / sample_spec[0].target).read_bytes() != sample:
            raise AssertionError("import altered the binary image")
        if check_destination(root, data, sample_spec):
            raise AssertionError("idempotent re-import should not rewrite identical files")
        (root / sample_spec[0].target).write_bytes(b"NOT APPROVED")
        try:
            check_destination(root, data, sample_spec)
            raise AssertionError("mismatched destination should be rejected")
        except ValueError:
            pass
        with zipfile.ZipFile(zip_path, "a") as archive:
            archive.writestr("../unexpected.webp", b"X")
        try:
            load_approved_zip(zip_path, sample_spec, digest(zip_path.read_bytes()), digest(manifest))
            raise AssertionError("unexpected ZIP paths must be rejected")
        except ValueError:
            pass
    print("PASS: exact ZIP validation, atomic image import, no overwrite, and path protections")

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", nargs="?", type=Path, help="approved NHS_Living_Atelier_Approved_Backgrounds.zip")
    parser.add_argument("--apply", action="store_true", help="copy exact images into the checked-out branch")
    parser.add_argument("--self-test", action="store_true", help="run synthetic tests without touching repository assets")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.package is None:
        parser.error("supply the approved ZIP path or --self-test")
    root = Path(__file__).resolve().parent.parent
    images = load_approved_zip(args.package)
    planned = check_destination(root, images)
    for asset in ASSETS:
        state = "READY" if any(path == root / asset.target for path, _ in planned) else "VERIFIED EXISTING"
        print(f"{state}: {asset.target} (sha256 {asset.sha256})")
    if not args.apply:
        print("DRY RUN ONLY. Re-run with --apply to copy the two verified WebP files.")
        return
    apply_images(planned)
    if check_destination(root, images):
        raise RuntimeError("STOP: the exact images were not all committed to the working tree")
    print("PASS: exact WebPs saved to working tree. Review diff and commit only to draft design branch.")
    print("The Observatory CSS remains on its original background until the scoped property is activated.")

if __name__ == "__main__":
    main()
