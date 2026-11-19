"""Package verified Qt desktop binaries without secrets or host-specific paths."""
import hashlib
import json
import shutil
import sys
import tarfile
from pathlib import Path

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def package(build, output):
    build, output = build.resolve(), output.resolve()
    root = output / "mechanicus-native"
    exe = build / "mas_native_desktop"
    libraries = sorted((build / "plugins").glob("libmas_native_*.so"))
    if not exe.is_file() or exe.is_symlink() or len(libraries) < 3:
        raise ValueError("native build is incomplete")
    if any(not p.is_file() or p.is_symlink() for p in libraries):
        raise ValueError("invalid native library")
    (root / "plugins").mkdir(parents=True, exist_ok=True)
    shutil.copy2(exe, root / exe.name)
    for file in libraries:
        shutil.copy2(file, root / "plugins" / file.name)
    pins = {"schema": "mas-native-plugin-pins-1", "plugins": [
        {"file": file.name, "sha256": digest(root / "plugins" / file.name)}
        for file in libraries
    ]}
    (root / "plugin-pins.json").write_text(
        json.dumps(pins, indent=2) + "\n", encoding="utf-8")
    (root / "README.txt").write_text(
        "Mechanicus Native — CI staging build (Linux x86_64)\n"
        "Requires a supported Linux and Qt6 6.4+ shared libraries; not a static AppImage.\n"
        "Core/graphics providers must be separately configured and authorized.\n"
        "Set ADA_CORE_URL and ADA_TOKEN locally using your own approved method.\n"
        "From this directory:\n"
        "  ./mas_native_desktop --plugins ./plugins --plugin-policy ./plugin-pins.json\n"
        "No credentials are bundled. This has been tested only headlessly in CI.\n"
        "Wayfire, real hardware FPS, Windows laptop and production deploy unverified.\n",
        encoding="utf-8")
    files = sorted(p for p in root.rglob("*") if p.is_file())
    (root / "SHA256SUMS").write_text(
        "".join(f"{digest(p)}  {p.relative_to(root)}\n" for p in files),
        encoding="utf-8")
    archive = output / "mechanicus-native-linux-x86_64.tar.gz"
    with tarfile.open(archive, "w:gz") as tar:
        for path in sorted(root.rglob("*")):
            tar.add(path, arcname=Path("mechanicus-native") / path.relative_to(root),
                    recursive=False)
    (output / (archive.name + ".sha256")).write_text(
        f"{digest(archive)}  {archive.name}\n", encoding="utf-8")
    return archive

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: package_linux.py BUILD_DIR OUTPUT_DIR")
    print(package(Path(sys.argv[1]), Path(sys.argv[2])))
