"""Aktualisiert die Website nach Änderungen an Fotos oder assets/data/playgrounds.json.

Aufruf: python tools/build.py
"""
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "assets" / "data" / "playgrounds.json"
IMAGES_DIR = ROOT / "assets" / "images"
BRANDING_FILE = IMAGES_DIR / "branding.png"
INDEX_FILE = ROOT / "index.html"
SITEMAP_FILE = ROOT / "sitemap.xml"
SW_FILE = ROOT / "sw.js"
BASE_URL = "https://xn--spielpltze-glcksburg-hzb84c.de/"
JSONLD_START, JSONLD_END = "<!-- playgrounds-jsonld:start -->", "<!-- playgrounds-jsonld:end -->"

# Endung -> (max. Breite, WebP-Qualität)
DEVICE_VARIANTS = {"": (1600, 80), "-thumb": (400, 72)}
MAIN_VARIANTS = {**DEVICE_VARIANTS, "-md": (960, 76)}


def validate(playgrounds):
    errors = []
    seen_ids = set()
    for index, playground in enumerate(playgrounds, start=1):
        label = f"Spielplatz {playground.get('name') or index}"
        for field in ("id", "name", "area", "latitude", "longitude", "description", "equipment"):
            if field not in playground:
                errors.append(f"{label}: Feld \"{field}\" fehlt.")
        playground_id = playground.get("id", "")
        if playground_id in seen_ids:
            errors.append(f"{label}: id \"{playground_id}\" ist doppelt vergeben.")
        seen_ids.add(playground_id)
        for field in ("latitude", "longitude"):
            if field in playground and not isinstance(playground[field], (int, float)):
                errors.append(f"{label}: \"{field}\" muss eine Zahl ohne Anführungszeichen sein.")
        photos = [playground.get("photo")] + [device.get("photo") for device in playground.get("equipment", [])]
        for photo in filter(None, photos):
            if not (IMAGES_DIR / playground_id / photo).is_file():
                errors.append(f"{label}: Foto fehlt: assets/images/{playground_id}/{photo}")
        for device in playground.get("equipment", []):
            if not device.get("name"):
                errors.append(f"{label}: Ein Gerät hat keinen Namen.")
    return errors


def load_image(path):
    image = ImageOps.exif_transpose(Image.open(path))
    image.load()
    if "A" in image.mode and image.getchannel("A").getextrema()[0] == 255:
        return image.convert("RGB")
    return image.convert("RGBA") if "A" in image.mode else image.convert("RGB")


def load_badge():
    overlay = Image.open(BRANDING_FILE).convert("RGBA")
    left, top, right, bottom = overlay.getchannel("A").getbbox()
    margins = (overlay.width - right, overlay.height - bottom)
    return overlay.crop((left, top, right, bottom)), margins, max(overlay.size)


def add_branding(image, badge):
    graphic, (margin_right, margin_bottom), reference_size = badge
    scale = max(image.size) / reference_size
    layer = graphic.resize((round(graphic.width * scale), round(graphic.height * scale)), Image.LANCZOS)
    position = (
        image.width - layer.width - round(margin_right * scale),
        image.height - layer.height - round(margin_bottom * scale),
    )
    branded = image.convert("RGBA")
    branded.alpha_composite(layer, position)
    return branded.convert(image.mode)


def convert(source, target, width, quality, badge):
    image = load_image(source)
    if image.width > width:
        image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    add_branding(image, badge).save(target, "WEBP", quality=quality, method=6)


def update_images(playgrounds):
    converted = 0
    badge = load_badge()
    branding_time = BRANDING_FILE.stat().st_mtime
    for playground in playgrounds:
        folder = IMAGES_DIR / playground["id"]
        jobs = [(playground.get("photo"), MAIN_VARIANTS)]
        jobs += [(device.get("photo"), DEVICE_VARIANTS) for device in playground["equipment"]]
        for photo, variants in jobs:
            if not photo:
                continue
            original = folder / photo
            stem = Path(photo).stem
            for suffix, (width, quality) in variants.items():
                target = folder / f"{stem}{suffix}.webp"
                # Manuell zugeschnittene Vorschaubilder (name-thumb.png) haben Vorrang.
                source = folder / f"{stem}-thumb{original.suffix}" if suffix == "-thumb" else original
                if not source.is_file():
                    source = original
                if target.is_file() and target.stat().st_mtime >= max(source.stat().st_mtime, branding_time):
                    continue
                convert(source, target, width, quality, badge)
                converted += 1
                print(f"  Foto erzeugt: {target.relative_to(ROOT).as_posix()}")
    return converted


def sort_key(playground):
    ranking = playground.get("ranking")
    return (ranking if isinstance(ranking, (int, float)) else float("inf"), playground["name"].casefold())


def update_structured_data(playgrounds):
    items = []
    for position, playground in enumerate(sorted(playgrounds, key=sort_key), start=1):
        item = {
            "@type": "Playground",
            "name": playground["name"],
            "description": playground["description"],
            "geo": {"@type": "GeoCoordinates", "latitude": playground["latitude"], "longitude": playground["longitude"]},
            "address": {"@type": "PostalAddress", "addressLocality": "Glücksburg", "addressCountry": "DE"},
            "amenityFeature": [
                {"@type": "LocationFeatureSpecification", "name": device["name"], "value": True}
                for device in playground["equipment"]
                if device.get("showInList") is not False
            ],
            "publicAccess": True,
            "isAccessibleForFree": True,
        }
        if playground.get("photo"):
            item["image"] = f"{BASE_URL}assets/images/{playground['id']}/{Path(playground['photo']).stem}.webp"
        items.append({"@type": "ListItem", "position": position, "item": item})

    json_ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Spielplätze in Glücksburg",
        "numberOfItems": len(items),
        "itemListElement": items,
    }
    script = json.dumps(json_ld, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    block = f'{JSONLD_START}\n  <script type="application/ld+json">{script}</script>\n  {JSONLD_END}'
    html = INDEX_FILE.read_text(encoding="utf-8")
    start, end = html.index(JSONLD_START), html.index(JSONLD_END) + len(JSONLD_END)
    updated = html[:start] + block + html[end:]
    if updated == html:
        return False
    INDEX_FILE.write_text(updated, encoding="utf-8")
    return True


def update_sitemap():
    xml = SITEMAP_FILE.read_text(encoding="utf-8")
    pattern = rf"(<loc>{re.escape(BASE_URL)}</loc>\s*<lastmod>)[^<]*(</lastmod>)"
    SITEMAP_FILE.write_text(re.sub(pattern, rf"\g<1>{date.today().isoformat()}\g<2>", xml), encoding="utf-8")


def update_service_worker():
    sw = SW_FILE.read_text(encoding="utf-8")
    shell = re.search(r"const APP_SHELL = \[(.*?)\];", sw, re.S).group(1)
    digest = hashlib.sha256()
    for path in re.findall(r'"\./([^"]*)"', shell):
        file = ROOT / (path or "index.html")
        digest.update(file.read_bytes())
    version = digest.hexdigest()[:10]
    updated = re.sub(r'const CACHE_NAME = "[^"]*";', f'const CACHE_NAME = "spielplaetze-gluecksburg-{version}";', sw)
    if updated != sw:
        SW_FILE.write_text(updated, encoding="utf-8")
        return True
    return False


def main():
    playgrounds = json.loads(DATA_FILE.read_text(encoding="utf-8-sig"))["playgrounds"]
    errors = validate(playgrounds)
    if errors:
        print("Bitte korrigieren:")
        print("\n".join(f"  - {error}" for error in errors))
        sys.exit(1)

    print("Fotos prüfen ...")
    converted = update_images(playgrounds)
    content_changed = update_structured_data(playgrounds) or converted > 0
    if content_changed:
        update_sitemap()
    sw_changed = update_service_worker()

    print(f"Fertig: {len(playgrounds)} Spielplätze, {converted} Fotos erzeugt"
          f"{', Cache-Version erneuert' if sw_changed else ''}.")


if __name__ == "__main__":
    main()
