"""Generuje DANE TESTOWE (makieta) zgodne z kontraktem JSON Field Twin.

Osoba od danych podmienia te pliki na prawdziwe wyniki z HLS / SMAP / IMERG,
zachowując te same klucze. Front niczego wtedy nie zmienia.

Uruchom:  python3 scripts/make_mock_data.py
"""
import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(2026)
OUT = Path(__file__).resolve().parent.parent / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def smooth(x, a, b):
    """0 przed a, 1 po b, gładko pomiędzy."""
    if x <= a:
        return 0.0
    if x >= b:
        return 1.0
    t = (x - a) / (b - a)
    return t * t * (3 - 2 * t)


# ---------- season.json: pole A, sezon 2026, tydzień po tygodniu ----------
start = date(2026, 3, 2)  # poniedziałek
weeks = []
for i in range(35):  # 2 marca – 26 października
    d = start + timedelta(weeks=i)
    w = i  # indeks tygodnia

    # Opady: norma ~ 9-18 mm/tydz. z maksimum latem; 2026 sucho, jedna burza z gradem
    precip_norm = 9 + 8 * math.sin(math.pi * (w + 2) / 38)
    precip = precip_norm * (0.55 if w < 8 else 0.3) * random.uniform(0.2, 1.4)
    if d == date(2026, 6, 15):
        precip = 24.0  # burza z gradem: dużo w krótkim czasie, większość odpływa
    if w > 27:
        precip = precip_norm * random.uniform(0.5, 1.1)

    # Woda w glebie (SMAP, m3/m3, okolica ~9 km)
    sm_norm = 0.31 - 0.085 * smooth(w, 4, 24) + 0.04 * smooth(w, 27, 34)
    sm = 0.27 - 0.155 * smooth(w, 3, 21) + 0.035 * smooth(w, 28, 34)
    if d == date(2026, 6, 15):
        sm += 0.02
    sm += random.uniform(-0.006, 0.006)

    # Zieloność pola (HLS NDVI, 30 m). Fasola siana ok. 18 maja.
    bare_base = 0.17
    ndvi_norm = bare_base + 0.6 * smooth(w, 12, 19) - 0.55 * smooth(w, 22, 27)
    ndvi = bare_base + 0.33 * smooth(w, 12, 17) - 0.32 * smooth(w, 17, 21)
    ndvi += random.uniform(-0.015, 0.015)
    ndvi = max(0.1, ndvi)
    cloudy = w in (2, 6, 11, 29, 31)  # chmury: brak pomiaru HLS
    bare = ndvi < 0.25

    weeks.append({
        "date": d.isoformat(),
        "precip_mm": round(precip, 1),
        "precip_norm": round(precip_norm, 1),
        "sm": round(sm, 3),
        "sm_norm": round(sm_norm, 3),
        "ndvi": None if cloudy else round(ndvi, 3),
        "ndvi_norm": round(ndvi_norm, 3),
        "bare_soil": bare,
    })

season = {
    "_mock": True,
    "field": {
        "id": "A",
        "name": "Pole A",
        "place": "okolice Tomaszowa Lubelskiego",
        "crop_2026": "Fasola",
        "area_ha": 42,
    },
    "weeks": weeks,
    "events": [
        {"date": "2026-04-20", "type": "frost", "label": "Przymrozek do −10°C"},
        {"date": "2026-05-18", "type": "sowing", "label": "Siew fasoli"},
        {"date": "2026-06-15", "type": "hail", "label": "Burza z gradem"},
        {"date": "2026-06-29", "type": "loss_start", "label": "Początek straty"},
        {"date": "2026-08-10", "type": "loss_end", "label": "Plon prawie zerowy"},
    ],
    "kpi": {
        "label": "Zieloność pola w lipcu w porównaniu ze średnią lat 2016–2025",
        "value": -62,
        "unit": "%",
        "mock": True,
    },
    "region_kpi": {
        "label": "Klimatyczny bilans wodny, woj. lubelskie",
        "value": -226,
        "unit": "mm",
        "source": "Tygodnik Rolniczy, 2026",
        "mock": False,
    },
    "official": {"label": "Aplikacja suszowa", "value": 11, "unit": "%"},
}
(OUT / "season.json").write_text(json.dumps(season, ensure_ascii=False, indent=1))

# ---------- fields.json: porównanie pól gospodarstwa (makieta) ----------
def strip(bare_ranges):
    """52 tygodnie 2026: True = goła gleba."""
    s = [False] * 52
    for a, b in bare_ranges:
        for i in range(a, b):
            s[i] = True
    return s

fields = {
    "_mock": True,
    "year": 2026,
    "fields": [
        {
            "id": "A", "name": "Pole A", "area_ha": 42, "soil": "lżejsza, piaszczysta",
            "crop_2026": "Fasola", "loss_pct": 96, "cover_crop": False, "slope_pct": 4.5,
            "runoff": "wysoki", "ndvi_drop_pct": -62,
            # goła po żniwach 2025 aż do wschodów fasoli, potem od lipca znów goła (uprawa padła)
            "bare": strip([(0, 22), (27, 52)]),
        },
        {
            "id": "B", "name": "Pole B", "area_ha": 55, "soil": "średnia",
            "crop_2026": "Rzepak, zaorany po suszy", "loss_pct": 70, "cover_crop": False, "slope_pct": 2.0,
            "runoff": "średni", "ndvi_drop_pct": -41,
            "bare": strip([(20, 52)]),
        },
        {
            "id": "C", "name": "Pole C", "area_ha": 61, "soil": "cięższa, trzyma wodę",
            "crop_2026": "Pszenica ozima", "loss_pct": 22, "cover_crop": True, "slope_pct": 0.8,
            "runoff": "niski", "ndvi_drop_pct": -14,
            "bare": strip([(30, 36)]),
        },
    ],
    "region": {
        "label": "Susza hydrologiczna w zlewni Bugu i Wieprza",
        "detail": "Wody gruntowe w regionie poniżej normy od czerwca (GRACE-FO, skala regionu, nie pola).",
    },
}
for f in fields["fields"]:
    f["bare_days"] = sum(f["bare"]) * 7
(OUT / "fields.json").write_text(json.dumps(fields, ensure_ascii=False, indent=1))

# ---------- plan.json: płodozmian na trzy sezony ----------
plan = {
    "_mock": True,
    "years": [2026, 2027, 2028, 2029],
    "rows": [
        {
            "field": "A", "label": "Pole A", "note": "najsuchsze, lżejsza gleba",
            "crops": ["Fasola", "Uprawa o mniejszym zapotrzebowaniu na wodę", "Zboże", "Fasola wraca po przerwie"],
            "crop_kind": ["loss", "dry", "cereal", "legume"],
            "winters": [False, True, True],
            "effect": "Gleba okryta zimą: mniej parowania i odpływu",
            "bare_days_now": 315, "bare_days_plan": 120,
        },
        {
            "field": "B", "label": "Pole B", "note": "średnie",
            "crops": ["Rzepak, zaorany po suszy", "Zboże jare", "Bobowata", "Rzepak wraca"],
            "crop_kind": ["loss", "cereal", "legume", "oilseed"],
            "winters": [False, True, False],
            "effect": "Bobowata wiąże azot, międzyplon chroni glebę",
            "bare_days_now": 224, "bare_days_plan": 110,
        },
        {
            "field": "C", "label": "Pole C", "note": "najlepiej trzyma wodę",
            "crops": ["Zboże, mniejsza strata", "Fasola przeniesiona z pola A", "Zboże", "Bobowata"],
            "crop_kind": ["cereal", "legume", "cereal", "legume"],
            "winters": [False, False, True],
            "effect": "Uprawa wrażliwa trafia tam, gdzie woda zostaje",
            "bare_days_now": 42, "bare_days_plan": 35,
        },
    ],
    "steps": [
        {
            "id": "cover", "title": "Międzyplony ozime", "when": "Po żniwach 2027 i 2028",
            "water": "Okryta gleba, mniej parowania i odpływu", "water_mm": 25, "water_mock": True,
            "cost_zl_ha": 260, "cost_mock": True,
            "subsidy_zl_ha": 437.6, "subsidy_note": "Ekoschemat, kampania 2025",
            "saving_zl_ha": [250, 400], "saving_note": "Mniej nawozów azotowych",
            "bio": True,
        },
        {
            "id": "sluice", "title": "Zastawki na rowach: zatrzymanie wody z roztopów", "when": "Zima 2026/27",
            "water": "Więcej wody w glebie na starcie wiosny", "water_mm": 15, "water_mock": True,
            "cost_label": "Niski", "subsidy_label": "Brak dopłaty",
            "caveat": "Może wymagać uzgodnienia ze spółką wodną lub Wodami Polskimi",
            "bio": False,
        },
        {
            "id": "notill", "title": "Uprawa uproszczona zamiast orki na polu A", "when": "Od 2027",
            "water": "Mniej parowania, więcej materii organicznej", "water_mock": True,
            "cost_label": "Zależny od sprzętu", "subsidy_label": "Rolnictwo węglowe: 4 pkt/ha",
            "bio": False,
        },
        {
            "id": "strip", "title": "Pas kwitnący na skraju pola", "when": "Wiosna 2027",
            "water": "Mniej erozji na skraju pola", "cost_zl_ha": 90, "cost_mock": True,
            "subsidy_label": "Ekoschemat: obszary z roślinami miododajnymi (stawka do sprawdzenia)",
            "bio": True,
        },
        {
            "id": "retention", "title": "Zbiornik retencyjny", "when": "2028",
            "water": "Zapas wody na suche tygodnie", "cost_label": "Wysoki",
            "subsidy_label": "Finansowanie niepewne",
            "caveat": "Nabór ARiMR przekroczył alokację, kolejne nie są planowane",
            "bio": True,
        },
    ],
}
(OUT / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))
print("ok:", [p.name for p in OUT.iterdir()])
