"""Trzy sąsiednie pola pod Tomaszowem Lubelskim: obrysy, teren, gleba, zdjęcia.

Granice pól odrysowane z ortofotomapy GUGiK (drogi, miedze, ścieżki technologiczne),
w miejscu wybranym na zdjęciu HLS z 26.07.2026:
  A - pole u góry, w lipcu 2026 jasne: goła gleba / ściernisko
  B - pole tuż pod A
  C - duże pole po drugiej stronie drogi, najdłużej zielone
Uprawy na polach nie są znane z publicznych danych; scenariusz (fasola itd.) to założenie.

Źródła (bez logowania):
  teren  - SRTM 30 m (NASA) przez api.opentopodata.org
  gleba  - SoilGrids 250 m (ISRIC) przez rest.isric.org
  zdjęcia - HLS S30 true color (NASA) przez gibs.earthdata.nasa.gov

Wyniki w tym folderze: fields.geojson, fields.json, img/*.png.
Odpowiedzi API są zapisywane w cache/, więc ponowne uruchomienie nic nie pobiera.
    python3 prepare_fields.py
"""

import json
import math
import statistics as st
import time
import urllib.request
from pathlib import Path

from pngtools import draw_polys, inside, read_png, write_png

HERE = Path(__file__).parent
CACHE = HERE / "cache"
IMG = HERE / "img"

VIEW_BBOX = (50.4105, 23.5175, 50.4315, 23.5465)  # lat_min, lon_min, lat_max, lon_max: kadr zdjęć
# Obrysy w pikselach ortofotomapy 2240x2240 px pokrywającej VIEW_BBOX (ok. 1 m/px)
REF_BBOX = VIEW_BBOX
REF_SIZE = (2240, 2240)
FIELDS_PX = {
    "A": [(1145, 518), (1680, 748), (1695, 768), (1430, 996), (890, 740)],
    "B": [(890, 746), (1425, 1002), (1255, 1170), (1095, 1255), (775, 1120), (600, 1270),
          (480, 1240), (470, 1095), (785, 815)],
    # wschodni skraj pola z ortofotomapy jest w 2026 osobną uprawą (Sentinel-2), więc C kończy się na x~1850
    "C": [(1262, 1182), (1500, 1262), (1690, 1292), (1850, 1339), (1765, 1822), (758, 1542), (1000, 1362)],
}
COLORS = {"A": (255, 60, 60), "B": (255, 200, 0), "C": (60, 170, 255)}
# bez chmur nad polami; S30 = Sentinel-2, L30 = Landsat (18.06 jest tylko Landsat)
CLEAR_DATES = {"2026-05-25": "S30", "2026-06-18": "L30", "2026-07-26": "S30", "2026-08-05": "S30"}


def px_to_geo(x, y, bbox=REF_BBOX, size=REF_SIZE):
    lat_min, lon_min, lat_max, lon_max = bbox
    return (lat_max - (y + .5) * (lat_max - lat_min) / size[1],
            lon_min + (x + .5) * (lon_max - lon_min) / size[0])


def geo_to_px(lat, lon, bbox, size):
    lat_min, lon_min, lat_max, lon_max = bbox
    return ((lon - lon_min) / (lon_max - lon_min) * size[0] - .5,
            (lat_max - lat) / (lat_max - lat_min) * size[1] - .5)


def fetch(url, cache_name, pause=0.0):
    path = CACHE / cache_name
    if path.exists():
        return path.read_bytes()
    time.sleep(pause)
    with urllib.request.urlopen(url, timeout=120) as r:
        data = r.read()
    path.write_bytes(data)
    return data


def area_ha(poly):
    lat0 = st.fmean(p[0] for p in poly)
    xy = [(lon * 111320 * math.cos(math.radians(lat0)), lat * 110574) for lat, lon in poly]
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(xy, xy[1:] + xy[:1]))) / 2 / 1e4


def in_geo(lat, lon, poly):
    return inside(lon, lat, [(p[1], p[0]) for p in poly])


# ---------- teren: SRTM 30 m ----------
def terrain(fields):
    lats = [p[0] for f in fields.values() for p in f]
    lons = [p[1] for f in fields.values() for p in f]
    dlat, dlon = 1 / 3600, 1.5 / 3600  # ~30 m x ~30 m na tej szerokości
    grid_lat = [min(lats) - dlat + i * dlat for i in range(int((max(lats) - min(lats)) / dlat) + 3)]
    grid_lon = [min(lons) - dlon + j * dlon for j in range(int((max(lons) - min(lons)) / dlon) + 3)]
    pts = [(a, o) for a in grid_lat for o in grid_lon]
    elev = {}
    for k in range(0, len(pts), 100):
        chunk = pts[k:k + 100]
        loc = "|".join(f"{a:.6f},{o:.6f}" for a, o in chunk)
        data = json.loads(fetch(f"https://api.opentopodata.org/v1/srtm30m?locations={loc}", f"srtm_{k}.json", pause=1.1))
        for (a, o), r in zip(chunk, data["results"]):
            elev[(a, o)] = r["elevation"]

    dy = dlat * 110574
    dx = dlon * 111320 * math.cos(math.radians(st.fmean(lats)))
    out = {}
    for name, poly in fields.items():
        slopes, aspects, heights = [], [], []
        for i in range(1, len(grid_lat) - 1):
            for j in range(1, len(grid_lon) - 1):
                a, o = grid_lat[i], grid_lon[j]
                if not in_geo(a, o, poly):
                    continue
                dzdx = (elev[(a, grid_lon[j + 1])] - elev[(a, grid_lon[j - 1])]) / (2 * dx)
                dzdy = (elev[(grid_lat[i + 1], o)] - elev[(grid_lat[i - 1], o)]) / (2 * dy)
                slopes.append(math.hypot(dzdx, dzdy) * 100)
                # kierunek spływu = przeciwny do gradientu; 0 = północ
                aspects.append((math.degrees(math.atan2(-dzdx, -dzdy)) + 360) % 360)
                heights.append(elev[(a, o)])
        mean_dir = math.degrees(math.atan2(sum(math.sin(math.radians(x)) for x in aspects),
                                           sum(math.cos(math.radians(x)) for x in aspects))) % 360
        out[name] = {
            "slope_mean_pct": round(st.fmean(slopes), 1),
            "slope_max_pct": round(max(slopes), 1),
            "elevation_min_m": min(heights),
            "elevation_max_m": max(heights),
            "flow_direction": "N NE E SE S SW W NW".split()[round(mean_dir / 45) % 8],
            "samples": len(slopes),
        }
    return out


# ---------- gleba: SoilGrids ----------
def soil(fields):
    out = {}
    for name, poly in fields.items():
        c = (st.fmean(p[0] for p in poly), st.fmean(p[1] for p in poly))
        # środek pola + dwa punkty w połowie drogi do skrajnych wierzchołków
        far = sorted(poly, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2)[-2:]
        samples = [c] + [((c[0] + p[0]) / 2, (c[1] + p[1]) / 2) for p in far]
        vals = {"clay": [], "sand": [], "silt": [], "soc": []}
        for k, (lat, lon) in enumerate(samples):
            url = ("https://rest.isric.org/soilgrids/v2.0/properties/query?"
                   f"lon={lon:.5f}&lat={lat:.5f}&property=clay&property=sand&property=silt&property=soc"
                   "&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean")
            data = json.loads(fetch(url, f"soil_{name}_{k}.json", pause=13))  # limit API: 5 zapytań/min
            for layer in data["properties"]["layers"]:
                d = layer["unit_measure"]["d_factor"]
                v = [x["values"]["mean"] for x in layer["depths"] if x["values"]["mean"] is not None]
                if v:
                    vals[layer["name"]].append(st.fmean(v) / d)
        r = {k: round(st.fmean(v), 1) if v else None for k, v in vals.items()}
        out[name] = {"clay_pct": r["clay"], "sand_pct": r["sand"], "silt_pct": r["silt"],
                     "soc_g_per_kg": r["soc"], "texture": texture(r["sand"], r["silt"], r["clay"])}
    return out


def texture(sand, silt, clay):
    """Uproszczona klasa USDA + opis dla rolnika + grupa hydrologiczna (A-D)."""
    if None in (sand, silt, clay):
        return {"usda": None, "label_pl": "brak danych", "hydro_group": None}
    if clay >= 40:
        return {"usda": "clay", "label_pl": "ciężka, ilasta", "hydro_group": "D"}
    if sand >= 70:
        return {"usda": "sand / loamy sand", "label_pl": "lekka, piaszczysta", "hydro_group": "A"}
    if silt >= 50 and clay < 27:
        return {"usda": "silt loam", "label_pl": "pyłowa (lessowa), dobrze trzyma wodę, podatna na erozję", "hydro_group": "B"}
    if sand >= 50:
        return {"usda": "sandy loam", "label_pl": "lżejsza, piaszczysto-gliniasta", "hydro_group": "B"}
    if clay >= 27:
        return {"usda": "clay loam", "label_pl": "cięższa, gliniasto-ilasta", "hydro_group": "C"}
    return {"usda": "loam", "label_pl": "średnia, gliniasta", "hydro_group": "B"}


def runoff(slope_pct, hydro_group):
    """Szacunek: grupa hydrologiczna gleby + klasa spadku -> niski / średni / wysoki."""
    score = {"A": 0, "B": 1, "C": 2, "D": 3}.get(hydro_group, 1)
    score += 0 if slope_pct < 2 else 1 if slope_pct < 5 else 2 if slope_pct < 10 else 3
    return "niski" if score <= 1 else "średni" if score <= 3 else "wysoki"


# ---------- zdjęcia HLS ----------
def images(fields):
    w, h = 560, 560
    paths = {}
    frames = []
    for d, layer in CLEAR_DATES.items():
        url = ("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0"
               f"&CRS=EPSG:4326&BBOX={','.join(map(str, VIEW_BBOX))}&WIDTH={w}&HEIGHT={h}&FORMAT=image/png&STYLES="
               f"&LAYERS=HLS_{layer}_Nadir_BRDF_Adjusted_Reflectance&TIME={d}")
        raw = IMG / f"hls_{d}.png"
        raw.write_bytes(fetch(url, f"hls_{layer}_{d}.png"))
        pw, ph, ch, rows = read_png(raw)
        polys = [[geo_to_px(a, o, VIEW_BBOX, (w, h)) for a, o in f] for f in fields.values()]
        draw_polys(rows, ch, polys, [COLORS[n] for n in fields], width=2)
        out = IMG / f"hls_{d}_fields.png"
        write_png(out, pw, ph, ch, rows)
        paths[d] = {"raw": f"img/{raw.name}", "with_fields": f"img/{out.name}"}
        frames.append((pw, ph, ch, rows))
    # zestawienie wszystkich dat w jednym obrazie
    gap = 8
    pw, ph, ch = frames[0][:3]
    total_w = len(frames) * pw + (len(frames) - 1) * gap
    strip = [bytearray(b"\xff" * (total_w * ch)) for _ in range(ph)]
    for k, (_, _, _, rows) in enumerate(frames):
        off = k * (pw + gap) * ch
        for y in range(ph):
            strip[y][off:off + pw * ch] = rows[y]
    write_png(IMG / "hls_sezon_2026_fields.png", total_w, ph, ch, strip)
    paths["season_strip"] = "img/hls_sezon_2026_fields.png"
    return paths


def main():
    CACHE.mkdir(exist_ok=True)
    IMG.mkdir(exist_ok=True)
    fields = {n: [tuple(round(v, 6) for v in px_to_geo(x, y)) for x, y in px] for n, px in FIELDS_PX.items()}

    topo = terrain(fields)
    soils = soil(fields)
    imgs = images(fields)

    result = {
        "location": "okolice Tomaszowa Lubelskiego (gm. Tomaszów Lubelski / Tarnawatka)",
        "image_bbox": dict(zip(["lat_min", "lon_min", "lat_max", "lon_max"], VIEW_BBOX)),
        "images": imgs,
        "sources": {
            "terrain": "SRTM 1 arc-second (NASA), api.opentopodata.org",
            "soil": "SoilGrids 2.0 (ISRIC), 250 m, warstwa 0-30 cm",
            "imagery": "HLS S30 v2.0 (NASA), NASA GIBS",
            "runoff": "szacunek: grupa hydrologiczna gleby + klasa spadku",
        },
        "fields": {},
    }
    features = []
    for n, poly in fields.items():
        lat_c, lon_c = st.fmean(p[0] for p in poly), st.fmean(p[1] for p in poly)
        info = {
            "centroid": [round(lat_c, 5), round(lon_c, 5)],
            "area_ha": round(area_ha(poly), 1),
            "terrain": topo[n],
            "soil": soils[n],
            "runoff_estimate": runoff(topo[n]["slope_mean_pct"], soils[n]["texture"]["hydro_group"]),
        }
        result["fields"][n] = info
        features.append({"type": "Feature", "properties": {"name": f"Pole {n}", **info},
                         "geometry": {"type": "Polygon", "coordinates": [[[o, a] for a, o in poly + poly[:1]]]}})
    (HERE / "fields.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    (HERE / "fields.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    for n, f in result["fields"].items():
        t, s = f["terrain"], f["soil"]
        print(f"Pole {n}: {f['area_ha']} ha, spadek {t['slope_mean_pct']}% (max {t['slope_max_pct']}%), "
              f"spływ {t['flow_direction']}, {t['elevation_min_m']}-{t['elevation_max_m']} m, "
              f"gleba: piasek {s['sand_pct']}% pył {s['silt_pct']}% ił {s['clay_pct']}% -> {s['texture']['label_pl']}, "
              f"odpływ: {f['runoff_estimate']}")


if __name__ == "__main__":
    main()
