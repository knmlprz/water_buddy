"""Powiększa zdjęcia HLS z img/ 4x (560 -> 2240 px) i rysuje ostre obrysy pól.

GIBS oddaje HLS powiększone metodą najbliższego sąsiada (piksel 30 m = ok. 8x7 px).
Skrypt uśrednia obraz z powrotem do siatki 30 m (ok. 69x78) i interpoluje ją
bikubicznie do 2240x2240, więc zamiast „schodków” jest gładki obraz.
Nie dodaje to szczegółów: rozdzielczość danych to nadal 30 m.

    python3 upscale_x4.py      # wyniki w img_x4/
"""

import json
import math
from pathlib import Path

from pngtools import draw_polys, read_png, write_png

HERE = Path(__file__).parent
SRC, OUT = HERE / "img", HERE / "img_x4"
SCALE = 4
NATIVE_M = 30  # rozdzielczość HLS
COLORS = {"A": (255, 60, 60), "B": (255, 200, 0), "C": (60, 170, 255)}


def native_size(bbox):
    """Liczba pikseli 30 m w poziomie i pionie kadru (piksel nie jest kwadratowy w px)."""
    lat_c = math.radians((bbox["lat_min"] + bbox["lat_max"]) / 2)
    gw = (bbox["lon_max"] - bbox["lon_min"]) * 111320 * math.cos(lat_c) / NATIVE_M
    gh = (bbox["lat_max"] - bbox["lat_min"]) * 110574 / NATIVE_M
    return round(gw), round(gh)


def to_grid(rows, ch, w, h, gw, gh):
    """Średnia pikseli obrazu w komórkach siatki natywnej gw x gh -> lista wierszy [r,g,b]."""
    acc = [[[0.0, 0.0, 0.0, 0] for _ in range(gw)] for _ in range(gh)]
    for y in range(h):
        cy = min(y * gh // h, gh - 1); r = rows[y]
        for x in range(w):
            c = acc[cy][min(x * gw // w, gw - 1)]
            c[0] += r[x * ch]; c[1] += r[x * ch + 1]; c[2] += r[x * ch + 2]; c[3] += 1
    return [[[c[0] / c[3], c[1] / c[3], c[2] / c[3]] for c in line] for line in acc]


def cubic_weights(t):
    # Catmull-Rom (a = -0.5)
    a = -0.5
    def k(x):
        x = abs(x)
        if x <= 1: return (a + 2) * x ** 3 - (a + 3) * x ** 2 + 1
        if x < 2: return a * x ** 3 - 5 * a * x ** 2 + 8 * a * x - 4 * a
        return 0.0
    return [k(t + 1), k(t), k(t - 1), k(t - 2)]


def resample_axis(lines, n_out):
    """Bikubiczne przeskalowanie każdej linii (lista [r,g,b]) do n_out próbek."""
    n_in = len(lines[0])
    taps = []
    for o in range(n_out):
        src = (o + .5) * n_in / n_out - .5
        i0 = int(src // 1)
        wts = cubic_weights(src - i0)
        taps.append([(min(max(i0 + k - 1, 0), n_in - 1), wts[k]) for k in range(4)])
    out = []
    for line in lines:
        res = []
        for tp in taps:
            r = g = b = 0.0
            for idx, wt in tp:
                p = line[idx]; r += p[0] * wt; g += p[1] * wt; b += p[2] * wt
            res.append([r, g, b])
        out.append(res)
    return out


def upscale(path, size, native):
    w, h, ch, rows = read_png(path)
    grid = to_grid(rows, ch, w, h, *native)
    horiz = resample_axis(grid, size)                       # gh x size
    cols = [[horiz[y][x] for y in range(len(horiz))] for x in range(size)]
    vert = resample_axis(cols, size)                        # size x size (kolumny)
    out_rows = []
    for y in range(size):
        line = bytearray(size * 3)
        for x in range(size):
            p = vert[x][y]
            line[x * 3:x * 3 + 3] = bytes(min(255, max(0, round(v))) for v in p)
        out_rows.append(line)
    return out_rows


def geo_to_px(lat, lon, bbox, size):
    return ((lon - bbox["lon_min"]) / (bbox["lon_max"] - bbox["lon_min"]) * size - .5,
            (bbox["lat_max"] - lat) / (bbox["lat_max"] - bbox["lat_min"]) * size - .5)


def main():
    OUT.mkdir(exist_ok=True)
    meta = json.loads((HERE / "fields.json").read_text())
    gj = json.loads((HERE / "fields.geojson").read_text())
    bbox = meta["image_bbox"]
    w0 = read_png(next(SRC.glob("hls_2026-*.png")))[0]
    size = w0 * SCALE
    polys = {f["properties"]["name"][-1]: [geo_to_px(lat, lon, bbox, size) for lon, lat in f["geometry"]["coordinates"][0][:-1]]
             for f in gj["features"]}

    framed = []
    for src in sorted(p for p in SRC.glob("hls_2026-??-??.png")):
        rows = upscale(src, size, native_size(bbox))
        write_png(OUT / f"{src.stem}_x4.png", size, size, 3, rows, level=6)
        draw_polys(rows, 3, list(polys.values()), [COLORS[n] for n in polys], width=4)
        write_png(OUT / f"{src.stem}_fields_x4.png", size, size, 3, rows, level=6)
        framed.append(rows)
        print("zapisano", src.stem, f"{size}x{size}", flush=True)

    gap = 24
    total = len(framed) * size + (len(framed) - 1) * gap
    strip = [bytearray(b"\xff" * (total * 3)) for _ in range(size)]
    for k, rows in enumerate(framed):
        off = k * (size + gap) * 3
        for y in range(size):
            strip[y][off:off + size * 3] = rows[y]
    write_png(OUT / "hls_sezon_2026_fields_x4.png", total, size, 3, strip, level=6)
    print("zapisano zestawienie sezonu", f"{total}x{size}")


if __name__ == "__main__":
    main()
