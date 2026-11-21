"""Ortofotomapa GUGiK (zdjęcie lotnicze, ok. 25 cm) dla kadru pól A, B, C.

To zdjęcie lotnicze, nie satelitarne, i nie z sezonu 2026: Geoportal nie podaje
pewnej daty nalotu dla tego miejsca. Służy jako ostre tło i do granic pól.
Źródło: WMS mapy.geoportal.gov.pl (PZGiK ORTO StandardResolution), bez logowania.

Wynik w img_orto/:
  orto_4096.jpg         - bez obrysów, 4096x4096 px (ok. 0,5 m/px)
  orto_2240_fields.png  - z obrysami pól, 2240x2240 px (ok. 1 m/px)
    python3 orthophoto.py
"""

import json
import urllib.request
from pathlib import Path

from pngtools import draw_polys, read_png, write_png

HERE = Path(__file__).parent
OUT = HERE / "img_orto"
CACHE = HERE / "cache"
WMS = ("https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution?SERVICE=WMS&REQUEST=GetMap"
       "&VERSION=1.3.0&LAYERS=Raster&STYLES=&CRS=EPSG:4326&BBOX={bbox}&WIDTH={size}&HEIGHT={size}&FORMAT={fmt}")
COLORS = {"A": (255, 60, 60), "B": (255, 200, 0), "C": (60, 170, 255)}


def fetch(url, name):
    path = CACHE / name
    if not path.exists():
        with urllib.request.urlopen(url, timeout=180) as r:
            path.write_bytes(r.read())
    return path


def main():
    OUT.mkdir(exist_ok=True)
    CACHE.mkdir(exist_ok=True)
    bb = json.loads((HERE / "fields.json").read_text())["image_bbox"]
    bbox = f"{bb['lat_min']},{bb['lon_min']},{bb['lat_max']},{bb['lon_max']}"

    (OUT / "orto_4096.jpg").write_bytes(fetch(WMS.format(bbox=bbox, size=4096, fmt="image/jpeg"), "orto_4096.jpg").read_bytes())

    size = 2240
    w, h, ch, rows = read_png(fetch(WMS.format(bbox=bbox, size=size, fmt="image/png"), "orto_2240.png"))
    gj = json.loads((HERE / "fields.geojson").read_text())
    polys, colors = [], []
    for f in gj["features"]:
        polys.append([((lon - bb["lon_min"]) / (bb["lon_max"] - bb["lon_min"]) * size - .5,
                       (bb["lat_max"] - lat) / (bb["lat_max"] - bb["lat_min"]) * size - .5)
                      for lon, lat in f["geometry"]["coordinates"][0][:-1]])
        colors.append(COLORS[f["properties"]["name"][-1]])
    draw_polys(rows, ch, polys, colors, width=4)
    write_png(OUT / "orto_2240_fields.png", w, h, ch, rows, level=6)
    print("zapisano img_orto/orto_4096.jpg i img_orto/orto_2240_fields.png")


if __name__ == "__main__":
    main()
