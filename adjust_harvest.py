"""Przesuwa miesięczny rozkład zbiorów w każdym punkcie na podstawie zdarzeń
pogodowych z Meteomatics (events_monthly.csv z fetch_events.py).

Zasady:
* suma roczna w każdym (uprawa, punkt, rok) zostaje dokładnie taka sama,
* plon przesuwa się tylko między miesiącami, w których uprawa ma zbiory
  w oryginalnym pliku (nie powstają zbiory w nowych miesiącach),
* zdarzenia liczone są względem normy danego punktu z lat 2015-2025.

Mechanizmy:
1. Tempo dojrzewania: upał, susza, słaba wilgotność gleby i dużo słońca
   w okresie dojrzewania przyspieszają zbiór (część plonu na wcześniejszy miesiąc);
   chłodny, mokry sezon i wiosenne przymrozki go opóźniają.
2. Warunki w miesiącu zbioru: dni deszczowe, ulewy, wichury i grad utrudniają
   zbiór, więc część plonu przechodzi na następny miesiąc.

Tylko biblioteka standardowa:
    python adjust_harvest.py df_poland_harvest.csv events_monthly.csv
"""

import argparse
import csv
import statistics
from collections import defaultdict
from decimal import Decimal

# Okno dojrzewania (przyspieszenie / opóźnienie) i okno wiosennych przymrozków
CROP_WINDOWS = {
    "Wheat": {"ripening": (5, 6), "frost": (4, 5)},
    "Maize": {"ripening": (7, 8), "frost": (4, 5)},
    "Soybean": {"ripening": (7, 8), "frost": (5,)},
}
MAX_ADVANCE = 0.5      # najwyżej połowa plonu miesiąca przesunięta o miesiąc
ADVANCE_COEF = 0.12    # przesunięcie na 1 odchylenie standardowe stresu
FROST_COEF = 0.06
MAX_DELAY = 0.35       # najwyżej 35% plonu miesiąca przechodzi na następny
DELAY_COEF = {"wet_days": 0.06, "heavy_rain_days": 0.06, "storm_days": 0.04, "hail_days": 0.04}

# Znak: + oznacza, że wysoka wartość przyspiesza dojrzewanie.
# drought_days pomijamy: indeks suszy w Polsce jest prawie zawsze <= -1,
# więc ta cecha jest stała; susza wchodzi przez drought_idx_mean.
RIPENING_SIGNALS = {
    "heat30_days": +1, "heat35_days": +1, "tmax_mean": +1, "sunshine_h": +1,
    "drought_idx_mean": -1, "water_balance_mm": -1, "et_mm": +1,
    "sm15_mean": -1, "sm50_mean": -1,
}


def load_events(path):
    ev = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            key = (r["lat"], r["lon"], int(r["year"]), int(r["month"]))
            # część cech jest pobierana tylko w wybranych miesiącach; puste pomijamy
            feats = {k: float(v) for k, v in r.items() if k not in ("lat", "lon", "year", "month") and v != ""}
            if "precip_mm" in feats and "et_mm" in feats:
                feats["water_balance_mm"] = feats["precip_mm"] - feats["et_mm"]
            ev[key] = feats
    # z-score względem normy tego samego punktu i miesiąca
    series = defaultdict(lambda: defaultdict(list))
    for (lat, lon, _, m), feats in ev.items():
        for f, v in feats.items():
            series[(lat, lon, m)][f].append(v)
    stats = {k: {f: (statistics.fmean(v), statistics.pstdev(v)) for f, v in fs.items()} for k, fs in series.items()}
    z = {}
    for (lat, lon, y, m), feats in ev.items():
        st = stats[(lat, lon, m)]
        z[(lat, lon, y, m)] = {f: (v - st[f][0]) / st[f][1] if st[f][1] > 1e-9 else 0.0 for f, v in feats.items()}
    return z


def window_mean(z, lat, lon, year, months, feature):
    vals = [z[(lat, lon, year, m)][feature] for m in months
            if (lat, lon, year, m) in z and feature in z[(lat, lon, year, m)]]
    return statistics.fmean(vals) if vals else 0.0


def clip(x, lo, hi):
    return max(lo, min(hi, x))


def reshape(profile, crop, lat, lon, year, z):
    """profile: {miesiąc: wartość}; zwraca nowy profil o tej samej sumie i drobne diagnostyki."""
    support = sorted(m for m, v in profile.items() if v > 0)
    lo, hi = support[0], support[-1]
    win = CROP_WINDOWS[crop]

    stress = statistics.fmean(
        sign * window_mean(z, lat, lon, year, win["ripening"], f) for f, sign in RIPENING_SIGNALS.items()
    )
    frost = window_mean(z, lat, lon, year, win["frost"], "frost_days")
    advance = clip(ADVANCE_COEF * stress - FROST_COEF * max(frost, 0), -MAX_ADVANCE, MAX_ADVANCE)

    new = {m: 0.0 for m in range(1, 13)}
    for m, v in profile.items():
        target = m - 1 if advance > 0 else m + 1
        if v and lo <= target <= hi:
            moved = v * abs(advance)
            new[target] += moved
            new[m] += v - moved
        else:
            new[m] += v

    # pogoda gorsza niż zwykle w miesiącu zbioru opóźnia go (część na m+1),
    # lepsza niż zwykle przyspiesza (część z m+1 wraca na m); symetria = brak dryfu
    delays = {}
    for m in range(lo, hi):  # ostatni miesiąc nie ma dokąd oddać
        zm = z.get((lat, lon, year, m))
        if not zm:
            continue
        d = clip(sum(c * zm.get(f, 0) for f, c in DELAY_COEF.items()), -MAX_DELAY, MAX_DELAY)
        src, dst = (m, m + 1) if d > 0 else (m + 1, m)
        moved = new[src] * abs(d)
        if moved:
            new[src] -= moved
            new[dst] += moved
            delays[m] = round(d, 3)
    return new, round(advance, 3), delays


def round_preserving_sum(values, total, decimals):
    """Zaokrągla do `decimals` miejsc tak, by suma była dokładnie `total` (metoda największych reszt)."""
    q = Decimal(1).scaleb(-decimals)
    target = Decimal(str(total)).quantize(q)
    floors = {m: (Decimal(repr(v)) / q).to_integral_value(rounding="ROUND_FLOOR") for m, v in values.items()}
    remainder = int(target / q - sum(floors.values()))
    order = sorted(values, key=lambda m: Decimal(repr(values[m])) / q - floors[m], reverse=True)
    for m in order[:remainder]:
        floors[m] += 1
    return {m: floors[m] * q for m in values}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("harvest_csv")
    ap.add_argument("events_csv")
    ap.add_argument("--out", default="df_poland_harvest_adjusted.csv")
    ap.add_argument("--shifts", default="harvest_shifts.csv")
    args = ap.parse_args()

    z = load_events(args.events_csv)

    # przebieg 1: profile miesięczne tylko dla niezerowych (uprawa, punkt, rok)
    profiles = defaultdict(dict)
    decimals = 0
    with open(args.harvest_csv, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            v = r["harvest_value"]
            if float(v) > 0:
                profiles[(r["crop"], r["lat"], r["lon"], int(r["year"]))][int(r["month"])] = float(v)
                if "." in v:
                    decimals = max(decimals, len(v.split(".")[1]))

    adjusted = {}
    with open(args.shifts, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["crop", "lat", "lon", "year", "advance", "delays"])
        for (crop, lat, lon, year), prof in profiles.items():
            new, adv, delays = reshape(prof, crop, lat, lon, year, z)
            total = sum(prof.values())
            adjusted[(crop, lat, lon, year)] = round_preserving_sum(new, total, decimals)
            w.writerow([crop, lat, lon, year, adv, ";".join(f"{m}:{d}" for m, d in delays.items())])

    # przebieg 2: przepisanie pliku w tej samej kolejności i formacie
    with open(args.harvest_csv, encoding="utf-8-sig") as fin, open(args.out, "w", newline="") as fout:
        reader = csv.DictReader(fin)
        w = csv.DictWriter(fout, fieldnames=reader.fieldnames)
        w.writeheader()
        for r in reader:
            prof = adjusted.get((r["crop"], r["lat"], r["lon"], int(r["year"])))
            if prof is not None:
                r["harvest_value"] = format(prof[int(r["month"])].normalize(), "f") if prof[int(r["month"])] else "0"
            w.writerow(r)
    print(f"Zapisano {args.out} i {args.shifts} ({len(profiles)} profili, {decimals} miejsc po przecinku)")


if __name__ == "__main__":
    main()
