"""Pobiera dzienną pogodę z Meteomatics dla siatki plonów (50x50 nad Polską)
i od razu agreguje ją do miesięcznych zdarzeń: susza, upał, przymrozek,
ulewa, wichura, grad, wilgotność gleby, usłonecznienie, ewapotranspiracja.

Oszczędnie z limitem konta (1000 zapytań/dobę, 10 równolegle):
* jedno zapytanie = cała siatka x grupa parametrów x jeden miesiąc,
* tanie parametry idą razem w pełnej rozdzielczości,
* drogie (ET, porywy, grad) na siatce 25x25 i przypisane najbliższemu punktowi,
* każdy parametr tylko w miesiącach, w których wpływa na zbiory.
Razem ok. 230 zapytań. Surowe dane dzienne nie są zapisywane.

Wznawialny: gotowe zadania są w events_progress.txt i są pomijane po restarcie.
Tylko biblioteka standardowa:
    python fetch_events.py df_poland_harvest.csv [--workers 6]
"""

import argparse
import calendar
import csv
import datetime as dt
import io
import os
import sys
import time
import urllib.error
import urllib.request
from base64 import b64encode
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

BASE_URL = "https://api.meteomatics.com"
YEARS = range(2015, 2026)


def _mean(v): return sum(v) / len(v)
def _count(pred): return lambda v: sum(1 for x in v if pred(x))

# parametr -> {cecha: agregacja listy wartości dziennych w miesiącu}
FEATURES = {
    "precip_24h:mm": {"precip_mm": sum, "wet_days": _count(lambda x: x >= 1), "heavy_rain_days": _count(lambda x: x >= 20)},
    "t_max_2m_24h:C": {"tmax_mean": _mean, "heat30_days": _count(lambda x: x >= 30), "heat35_days": _count(lambda x: x >= 35)},
    "t_min_2m_24h:C": {"frost_days": _count(lambda x: x < 0), "hard_frost_days": _count(lambda x: x <= -4)},
    "drought_index:idx": {"drought_idx_mean": _mean, "drought_days": _count(lambda x: x <= -1)},
    "soil_moisture_index_-15cm:idx": {"sm15_mean": _mean},
    "soil_moisture_index_-50cm:idx": {"sm50_mean": _mean},
    "sunshine_duration_24h:min": {"sunshine_h": lambda v: sum(v) / 60},
    "evapotranspiration_24h:mm": {"et_mm": sum},
    "wind_gusts_10m_24h:ms": {"storm_days": _count(lambda x: x >= 20)},
    "hail_24h:cm": {"hail_days": _count(lambda x: x > 0)},
}

# grupa -> (parametry, miesiące, rozmiar siatki)
GROUPS = {
    "season": (["precip_24h:mm", "t_max_2m_24h:C", "t_min_2m_24h:C", "drought_index:idx",
                "soil_moisture_index_-15cm:idx", "soil_moisture_index_-50cm:idx",
                "sunshine_duration_24h:min"], range(4, 9), 50),
    "late_rain": (["precip_24h:mm"], range(9, 13), 50),
    "storms": (["wind_gusts_10m_24h:ms", "hail_24h:cm"], range(5, 13), 25),
    "et": (["evapotranspiration_24h:mm"], range(5, 9), 25),
}


def credentials() -> str:
    env = Path(__file__).with_name(".env")
    if env.exists():
        for line in env.read_text().splitlines():
            k, sep, v = line.partition("=")
            if sep:
                os.environ.setdefault(k.strip(), v.strip())
    user = os.environ["METEOMATICS_USER"]
    pwd = os.environ.get("METEOMATICS_PASS") or os.environ["METEOMATICS_PASSWORD"]
    return "Basic " + b64encode(f"{user}:{pwd}".encode()).decode()


class Grid:
    """Siatka plonów odczytana z pliku (strumieniowo) + mapowanie na siatki API."""

    def __init__(self, path: str):
        lats, lons, pts = set(), set(), set()
        with open(path, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                lats.add(float(r["lat"])); lons.add(float(r["lon"]))
                if float(r["harvest_value"]) > 0:
                    pts.add((r["lat"], r["lon"]))
        self.lat0, self.lat1 = min(lats), max(lats)
        self.lon0, self.lon1 = min(lons), max(lons)
        self.n = len(lats)
        self.points = sorted(pts)

    def spec(self, size: int) -> str:
        return f"{self.lat1},{self.lon0}_{self.lat0},{self.lon1}:{size}x{size}"

    def cell(self, lat: float, lon: float, size: int) -> tuple[int, int]:
        # indeks najbliższego węzła siatki size x size w tych samych granicach
        i = round((lat - self.lat0) / (self.lat1 - self.lat0) * (size - 1))
        j = round((lon - self.lon0) / (self.lon1 - self.lon0) * (size - 1))
        return i, j

    def members(self, size: int) -> dict[tuple[int, int], list[tuple[str, str]]]:
        out = defaultdict(list)
        for a, o in self.points:
            out[self.cell(float(a), float(o), size)].append((a, o))
        return out


def request(auth: str, url: str) -> str:
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"Authorization": auth})
            with urllib.request.urlopen(req, timeout=1800) as r:
                return r.read().decode()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503) or attempt == 2:
                raise RuntimeError(f"HTTP {e.code}: {e.read()[:300]!r} for {url[:120]}")
        time.sleep(30 * (attempt + 1))


def run_task(auth, grid, members, group, year, month):
    params, _, size = GROUPS[group]
    # *_24h w validdate opisuje dobę wcześniej: dni 1..N miesiąca = validdate 2..N+1
    start = dt.date(year, month, 1) + dt.timedelta(days=1)
    end = dt.date(year, month, calendar.monthrange(year, month)[1]) + dt.timedelta(days=1)
    text = request(auth, f"{BASE_URL}/{start}T00:00:00Z--{end}T00:00:00Z:P1D/{','.join(params)}/{grid.spec(size)}/csv")

    daily = defaultdict(lambda: defaultdict(list))
    rows = csv.reader(io.StringIO(text), delimiter=";")
    header = next(rows)
    for r in rows:
        c = grid.cell(float(r[0]), float(r[1]), size)
        for p, v in zip(header[3:], r[3:]):
            daily[c][p].append(float(v))
    out = []
    for c, by_param in daily.items():
        feats = [(name, round(fn(by_param[p]), 3)) for p in params for name, fn in FEATURES[p].items()]
        for a, o in members[size].get(c, ()):
            out.extend((a, o, year, month, name, val) for name, val in feats)
    return out


def pivot(long_path: Path, out_path: Path):
    wide = defaultdict(dict)
    with open(long_path) as f:
        for r in csv.DictReader(f):
            wide[(r["lat"], r["lon"], r["year"], r["month"])][r["feature"]] = r["value"]
    features = [f for fs in FEATURES.values() for f in fs]
    with open(out_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lat", "lon", "year", "month"] + features)
        for key in sorted(wide, key=lambda k: (k[0], k[1], int(k[2]), int(k[3]))):
            w.writerow(list(key) + [wide[key].get(feat, "") for feat in features])
    return len(wide)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("harvest_csv")
    ap.add_argument("--out", default="events_monthly.csv")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    auth = credentials()
    grid = Grid(args.harvest_csv)
    members = {size: grid.members(size) for size in {g[2] for g in GROUPS.values()}}
    long_path = Path(args.out).with_name("events_long.csv")
    progress = Path(args.out).with_name("events_progress.txt")
    done = set(progress.read_text().split()) if progress.exists() else set()

    tasks = [(g, y, m) for g, (_, months, _) in GROUPS.items() for y in YEARS for m in months]
    todo = [t for t in tasks if "|".join(map(str, t)) not in done]
    print(f"{len(grid.points)} punktów, zadań {len(tasks)}, do zrobienia {len(todo)}", flush=True)

    new_file = not long_path.exists()
    with open(long_path, "a", newline="") as f, open(progress, "a") as prog:
        w = csv.writer(f)
        if new_file:
            w.writerow(["lat", "lon", "year", "month", "feature", "value"])
        t0 = time.time()
        with ThreadPoolExecutor(args.workers) as ex:
            futs = {ex.submit(run_task, auth, grid, members, *t): t for t in todo}
            for n, fut in enumerate(as_completed(futs), 1):
                try:
                    rows = fut.result()
                except Exception as e:  # jedno nieudane zadanie nie przerywa reszty
                    print(f"BŁĄD {futs[fut]}: {e}", flush=True)
                    continue
                w.writerows(rows)
                f.flush()
                prog.write("|".join(map(str, futs[fut])) + "\n")
                prog.flush()
                if n % 10 == 0 or n == len(todo):
                    print(f"{n}/{len(todo)} zadań, {time.time() - t0:.0f}s", flush=True)

    print(f"zapisano {pivot(long_path, Path(args.out))} wierszy do {args.out}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
