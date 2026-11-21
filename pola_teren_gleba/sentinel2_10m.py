"""Zdjęcia Sentinel-2 L2A w 10 m (true color) dla kadru pól A, B, C, sezon 2026.

Źródło: Sentinel-2 L2A COG w otwartym zbiorze AWS (Element 84 Earth Search),
bez logowania. Z każdej sceny pobierane są tylko kafle obejmujące kadr
(zapytania HTTP Range), a nie cały plik 110x110 km.

Wynik w img_s2/: s2_<data>.png i s2_<data>_fields.png (1120x1120 px, ok. 2 m/px,
interpolacja bikubiczna z 10 m) + zestawienie bezchmurnych dat.
Tylko biblioteka standardowa:
    python3 sentinel2_10m.py
"""

import json
import math
import struct
import urllib.request
import zlib
from pathlib import Path

from pngtools import draw_polys, inside, read_png, write_png

HERE = Path(__file__).parent
CACHE = HERE / "cache" / "s2"
OUT = HERE / "img_s2"
SIZE = 1120
COLORS = {"A": (255, 60, 60), "B": (255, 200, 0), "C": (60, 170, 255)}
MAX_CLOUD_IN_FIELDS = 0.01  # odrzucamy daty z chmurą lub cieniem nad >1% pól (wg SCL)


# ---------- WGS84 -> UTM ----------
def to_utm(lat, lon, zone):
    a, f = 6378137.0, 1 / 298.257223563
    e2 = f * (2 - f); ep2 = e2 / (1 - e2); k0 = 0.9996
    phi, lam = math.radians(lat), math.radians(lon)
    lam0 = math.radians(zone * 6 - 183)
    n = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    t = math.tan(phi) ** 2; c = ep2 * math.cos(phi) ** 2; A = math.cos(phi) * (lam - lam0)
    m = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
             - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * phi)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * phi)
             - (35 * e2 ** 3 / 3072) * math.sin(6 * phi))
    x = k0 * n * (A + (1 - t + c) * A ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * A ** 5 / 120) + 500000
    y = k0 * (m + n * math.tan(phi) * (A * A / 2 + (5 - t + 9 * c + 4 * c * c) * A ** 4 / 24
                                       + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * A ** 6 / 720))
    return x, y


# ---------- HTTP z cache ----------
def get(url, start=None, end=None, name=None):
    path = CACHE / name if name else None
    if path and path.exists():
        return path.read_bytes()
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"} if start is not None else {})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if path:
        path.write_bytes(data)
    return data


def stac_search(lat, lon):
    body = json.dumps({
        "collections": ["sentinel-2-l2a"],
        "intersects": {"type": "Point", "coordinates": [lon, lat]},
        "datetime": "2026-04-01T00:00:00Z/2026-09-30T23:59:59Z",
        "query": {"eo:cloud_cover": {"lt": 60}},
        "limit": 100,
    }).encode()
    req = urllib.request.Request("https://earth-search.aws.element84.com/v1/search", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        feats = json.load(r)["features"]
    scenes = {}
    for f in feats:
        day = f["properties"]["datetime"][:10]
        # jedna scena na dzień (kafle MGRS mogą się powtarzać)
        scenes.setdefault(day, {"id": f["id"], "href": f["assets"]["visual"]["href"], "scl": f["assets"]["scl"]["href"],
                                "epsg": f["properties"].get("proj:epsg") or f["properties"].get("proj:code")})
    return dict(sorted(scenes.items()))


# ---------- czytnik GeoTIFF/COG (deflate, predictor 2, 8 bit, kafle) ----------
class COG:
    def __init__(self, url, key):
        self.url, self.key = url, key
        head = get(url, 0, 262143, f"{key}_head.bin")
        bo = "<" if head[:2] == b"II" else ">"
        self.bo = bo
        off = struct.unpack(bo + "I", head[4:8])[0]
        n = struct.unpack(bo + "H", head[off:off + 2])[0]
        tags = {}
        for i in range(n):
            tag, typ, cnt = struct.unpack(bo + "HHI", head[off + 2 + i * 12: off + 10 + i * 12])
            raw = head[off + 10 + i * 12: off + 14 + i * 12]
            fmt = {3: "H", 4: "I", 12: "d", 16: "Q"}.get(typ, "B")
            size = struct.calcsize(fmt) * cnt
            data = raw if size <= 4 else head[struct.unpack(bo + "I", raw)[0]:][:size]
            tags[tag] = struct.unpack(bo + fmt * cnt, data[:size])
        assert tags[259][0] == 8, "spodziewana kompresja deflate"
        self.w, self.h = tags[256][0], tags[257][0]
        self.tw, self.th = tags[322][0], tags[323][0]
        self.offsets, self.counts = tags[324], tags[325]
        self.predictor = tags.get(317, (1,))[0]
        self.spp = tags.get(277, (1,))[0]
        self.scale = tags[33550][:2]
        self.origin = tags[33922][3:5]
        self.tiles_x = math.ceil(self.w / self.tw)
        self.cache = {}

    def tile(self, tx, ty):
        if (tx, ty) not in self.cache:
            i = ty * self.tiles_x + tx
            data = zlib.decompress(get(self.url, self.offsets[i], self.offsets[i] + self.counts[i] - 1,
                                       f"{self.key}_t{i}.bin"))
            n = self.spp
            rows = [bytearray(data[r * self.tw * n:(r + 1) * self.tw * n]) for r in range(self.th)]
            if self.predictor == 2:
                for row in rows:
                    for x in range(n, len(row)):
                        row[x] = (row[x] + row[x - n]) & 255
            self.cache[(tx, ty)] = rows
        return self.cache[(tx, ty)]

    def pixel(self, col, row):
        col = min(max(col, 0), self.w - 1); row = min(max(row, 0), self.h - 1)
        t = self.tile(col // self.tw, row // self.th)[row % self.th]
        x = (col % self.tw) * self.spp
        return tuple(t[x:x + self.spp])


def cubic(t):
    a = -0.5
    def k(x):
        x = abs(x)
        return (a + 2) * x ** 3 - (a + 3) * x ** 2 + 1 if x <= 1 else a * x ** 3 - 5 * a * x ** 2 + 8 * a * x - 4 * a if x < 2 else 0.0
    return (k(t + 1), k(t), k(t - 1), k(t - 2))


def render(cog, bbox, zone, size=SIZE):
    """Kadr bbox (lat/lon) -> size x size RGB, próbkowanie bikubiczne z siatki 10 m."""
    lat_min, lon_min, lat_max, lon_max = bbox["lat_min"], bbox["lon_min"], bbox["lat_max"], bbox["lon_max"]
    # na 2 km odwzorowanie lat/lon -> UTM jest praktycznie afiniczne: liczymy je z trzech narożników
    def src(lat, lon):
        x, y = to_utm(lat, lon, zone)
        return (x - cog.origin[0]) / cog.scale[0] - .5, (cog.origin[1] - y) / cog.scale[1] - .5
    p00 = src(lat_max, lon_min); p10 = src(lat_max, lon_max); p01 = src(lat_min, lon_min)
    dx = ((p10[0] - p00[0]) / size, (p10[1] - p00[1]) / size)
    dy = ((p01[0] - p00[0]) / size, (p01[1] - p00[1]) / size)
    # bufor źródłowy wokół kadru
    cs = [p00[0], p10[0], p01[0], p10[0] + p01[0] - p00[0]]
    rs = [p00[1], p10[1], p01[1], p10[1] + p01[1] - p00[1]]
    c0, c1, r0, r1 = int(min(cs)) - 3, int(max(cs)) + 4, int(min(rs)) - 3, int(max(rs)) + 4
    buf = [[cog.pixel(c, r) for c in range(c0, c1)] for r in range(r0, r1)]
    out = []
    for oy in range(size):
        line = bytearray(size * 3)
        for ox in range(size):
            sx = p00[0] + (ox + .5) * dx[0] + (oy + .5) * dy[0] - c0
            sy = p00[1] + (ox + .5) * dx[1] + (oy + .5) * dy[1] - r0
            ix, iy = int(sx), int(sy)
            wx, wy = cubic(sx - ix), cubic(sy - iy)
            acc = [0.0, 0.0, 0.0]
            for j in range(4):
                brow = buf[iy - 1 + j]; wj = wy[j]
                for i in range(4):
                    p = brow[ix - 1 + i]; wgt = wj * wx[i]
                    acc[0] += p[0] * wgt; acc[1] += p[1] * wgt; acc[2] += p[2] * wgt
            line[ox * 3:ox * 3 + 3] = bytes(min(255, max(0, round(v))) for v in acc)
        out.append(line)
    return out


# klasy SCL: 3 cień chmury, 8 chmura średnia, 9 chmura gęsta, 10 cirrus, 0/1 brak danych / wada
BAD_SCL = {0, 1, 3, 8, 9, 10}


def scl_cloud_fraction(scl, geo_polys, zone):
    """Udział pikseli SCL (20 m) z chmurą/cieniem wewnątrz pól; próbki co ok. 10 m."""
    n = bad = 0
    for poly in geo_polys:
        lats = [p[1] for p in poly]; lons = [p[0] for p in poly]
        lat, step_lat, step_lon = min(lats), 0.00009, 0.00014
        while lat <= max(lats):
            lon = min(lons)
            while lon <= max(lons):
                if inside(lon, lat, poly):
                    x, y = to_utm(lat, lon, zone)
                    cls = scl.pixel(int((x - scl.origin[0]) / scl.scale[0]), int((scl.origin[1] - y) / scl.scale[1]))[0]
                    n += 1; bad += cls in BAD_SCL
                lon += step_lon
            lat += step_lat
    return bad / max(n, 1)


def cloud_fraction(rows, polys, size):
    n = bad = 0
    for y in range(size):
        for x in range(size):
            if any(inside(x, y, p) for p in polys):
                r, g, b = rows[y][x * 3:x * 3 + 3]
                n += 1
                bad += (min(r, g, b) > 200) or (r + g + b == 0)
    return bad / max(n, 1)


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)
    meta = json.loads((HERE / "fields.json").read_text())
    bbox = meta["image_bbox"]
    gj = json.loads((HERE / "fields.geojson").read_text())
    names = [f["properties"]["name"][-1] for f in gj["features"]]
    polys = [[((lon - bbox["lon_min"]) / (bbox["lon_max"] - bbox["lon_min"]) * SIZE - .5,
               (bbox["lat_max"] - lat) / (bbox["lat_max"] - bbox["lat_min"]) * SIZE - .5)
              for lon, lat in f["geometry"]["coordinates"][0][:-1]] for f in gj["features"]]
    geo_polys = [f["geometry"]["coordinates"][0][:-1] for f in gj["features"]]
    lat_c = (bbox["lat_min"] + bbox["lat_max"]) / 2; lon_c = (bbox["lon_min"] + bbox["lon_max"]) / 2

    scenes = stac_search(lat_c, lon_c)
    print(f"{len(scenes)} scen Sentinel-2 (zachmurzenie sceny < 60%)", flush=True)
    kept = []
    for day, s in scenes.items():
        zone = int(str(s["epsg"])[-2:])
        cog = COG(s["href"], s["id"])
        # maska chmur i cieni z warstwy klasyfikacji sceny (SCL, 20 m)
        cf = scl_cloud_fraction(COG(s["scl"], s["id"] + "_scl"), geo_polys, zone)
        status = "OK" if cf <= MAX_CLOUD_IN_FIELDS else "chmury"
        print(f"{day} {s['id']}: chmury nad polami {cf:.0%} -> {status}", flush=True)
        if status != "OK":
            continue
        done = OUT / f"s2_{day}.png"
        rows = read_png(done)[3] if done.exists() else render(cog, bbox, zone)
        write_png(OUT / f"s2_{day}.png", SIZE, SIZE, 3, rows, level=6)
        draw_polys(rows, 3, polys, [COLORS[n] for n in names], width=3)
        write_png(OUT / f"s2_{day}_fields.png", SIZE, SIZE, 3, rows, level=6)
        kept.append((day, rows))

    # zestawienie: siatka miniatur (pomniejszenie 2x przez uśrednienie), kolejność dat jak w dates.json
    cols, half, gap = 5, SIZE // 2, 12
    n_rows = math.ceil(len(kept) / cols)
    gw, gh = cols * half + (cols - 1) * gap, n_rows * half + (n_rows - 1) * gap
    grid = [bytearray(b"\xff" * (gw * 3)) for _ in range(gh)]
    for k, (_, rows) in enumerate(kept):
        ox, oy = (k % cols) * (half + gap), (k // cols) * (half + gap)
        for y in range(half):
            r0, r1, line = rows[2 * y], rows[2 * y + 1], grid[oy + y]
            for x in range(half):
                for c in range(3):
                    i = 6 * x + c
                    line[(ox + x) * 3 + c] = (r0[i] + r0[i + 3] + r1[i] + r1[i + 3] + 2) // 4
    write_png(OUT / "s2_sezon_2026_fields.png", gw, gh, 3, grid, level=6)
    (OUT / "dates.json").write_text(json.dumps([d for d, _ in kept]))
    print("bezchmurne daty:", ", ".join(d for d, _ in kept))


if __name__ == "__main__":
    main()
