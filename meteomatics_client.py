"""Dane z Meteomatics API dla dowolnych chwil i wielu miejsc naraz.

Zwraca DataFrame w tym samym układzie co fetch_aggregated_climate() kolegi:
kolumny lat, lon, validdate, <parametry> (+ opcjonalnie name), więc wyniki
obu funkcji można łączyć przez pd.concat / pd.merge.

Dane logowania: argument credentials albo zmienne METEOMATICS_USER
i METEOMATICS_PASS (jak u kolegi; METEOMATICS_PASSWORD też działa).

Przykład:
    df = fetch_weather(
        times=("2026-06-01", "2026-08-31"), step="P1D",
        locations={"pole_A": (50.55, 23.42), "pole_C": (50.57, 23.45)},
        parameters=["t_2m:C", "precip_24h:mm"],
    )
"""

from __future__ import annotations

import datetime as dt
import io
import os
import re
import time
from typing import Mapping, Sequence, Union

import pandas as pd
import requests

BASE_URL = "https://api.meteomatics.com"

DEFAULT_PARAMETERS = [
    "t_2m:C",
    "precip_1h:mm",
    "relative_humidity_2m:p",
    "wind_speed_10m:ms",
]

TimeLike = Union[str, dt.date, dt.datetime, pd.Timestamp]
LatLon = tuple[float, float]
Locations = Union[LatLon, Sequence[LatLon], Mapping[str, LatLon]]

# Limity jednego zapytania, takie same jak u kolegi + limit kroków czasu,
# żeby zapytanie godzinowe na rok nie przekroczyło limitu wartości w API.
MAX_POINTS_PER_REQUEST = 50
MAX_PARAMS_PER_REQUEST = 10
MAX_STEPS_PER_REQUEST = 2000


def get_credentials(credentials: tuple[str, str] | None = None) -> tuple[str, str]:
    if credentials:
        return credentials
    user = os.environ.get("METEOMATICS_USER")
    password = os.environ.get("METEOMATICS_PASS") or os.environ.get("METEOMATICS_PASSWORD")
    if not user or not password:
        raise RuntimeError("Podaj credentials=(user, pass) albo ustaw METEOMATICS_USER i METEOMATICS_PASS")
    return user, password


def _ts(t: TimeLike) -> pd.Timestamp:
    """Dowolny zapis czasu -> pd.Timestamp w UTC (czas bez strefy traktujemy jako UTC)."""
    ts = pd.Timestamp(t)
    return ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")


def _iso(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M:%SZ")


def _step_to_timedelta(step: str) -> pd.Timedelta:
    # obsługujemy kroki ISO 8601 używane w praktyce: PnD, PTnH, PTnM, PTnS
    m = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", step)
    if not m or not any(m.groups()):
        raise ValueError(f"Nieobsługiwany krok '{step}', użyj np. PT1H, PT15M, P1D")
    d, h, mi, s = (int(g or 0) for g in m.groups())
    return pd.Timedelta(days=d, hours=h, minutes=mi, seconds=s)


def _time_segments(times, step: str | None) -> list[str]:
    """Krotka (start, koniec) = zakres z krokiem; lista = konkretne chwile; inaczej jedna chwila."""
    if isinstance(times, tuple):
        if len(times) != 2:
            raise ValueError("Zakres czasu to krotka (start, koniec)")
        step = step or "PT1H"
        delta = _step_to_timedelta(step)
        start, end = _ts(times[0]), _ts(times[1])
        if start > end:
            raise ValueError("Początek zakresu jest późniejszy niż koniec")
        segments = []
        while start <= end:
            chunk_end = min(start + delta * (MAX_STEPS_PER_REQUEST - 1), end)
            segments.append(f"{_iso(start)}--{_iso(chunk_end)}:{step}")
            start = chunk_end + delta
        return segments
    if isinstance(times, list):
        stamps = [_iso(_ts(t)) for t in times]
        return [",".join(stamps[i : i + MAX_STEPS_PER_REQUEST]) for i in range(0, len(stamps), MAX_STEPS_PER_REQUEST)]
    return [_iso(_ts(times))]


def day_range(start: TimeLike, end: TimeLike) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Zakres dni kalendarzowych pod parametry *_24h z step="P1D".

    Wartość *_24h w validdate opisuje dobę przed nią, więc przesuwamy o +1 dzień,
    tak samo jak fetch_aggregated_climate() kolegi (validdate wyjdzie identyczne).
    """
    one_day = pd.Timedelta(days=1)
    return _ts(start).normalize() + one_day, _ts(end).normalize() + one_day


def _normalize_locations(locations: Locations) -> tuple[list[LatLon], list[str] | None]:
    if isinstance(locations, Mapping):
        return [(float(lat), float(lon)) for lat, lon in locations.values()], list(locations)
    if len(locations) == 2 and all(isinstance(v, (int, float)) for v in locations):
        return [(float(locations[0]), float(locations[1]))], None
    return [(float(lat), float(lon)) for lat, lon in locations], None


def _chunks(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


def fetch_weather(
    times: TimeLike | tuple[TimeLike, TimeLike] | list[TimeLike],
    locations: Locations,
    parameters: list[str] = DEFAULT_PARAMETERS,
    step: str | None = None,
    credentials: tuple[str, str] | None = None,
    model: str | None = None,
    pause_sec: float = 0.2,
) -> pd.DataFrame:
    """Jeden wiersz na (miejsce, chwila), kolumna na każdy parametr.

    times:      jedna chwila, lista chwil albo krotka (start, koniec) z `step`
                ("PT1H" domyślnie, "PT15M", "PT3H", "P1D" ...). Czas bez strefy = UTC.
    locations:  (lat, lon), lista [(lat, lon), ...] albo słownik {nazwa: (lat, lon)};
                przy słowniku wynik ma dodatkową kolumnę `name`.
    parameters: nazwy Meteomatics z jednostką, np. "t_2m:C", "precip_24h:mm".
                Parametry *_24h w chwili validdate opisują 24 h PRZED nią.
    model:      opcjonalnie wybrany model/źródło Meteomatics (domyślnie "mix").
    """
    if not parameters:
        raise ValueError("Lista parametrów nie może być pusta")
    auth = get_credentials(credentials)
    points, names = _normalize_locations(locations)
    query = {"model": model} if model else None

    frames = []
    for time_seg in _time_segments(times, step):
        for pt_batch in _chunks(points, MAX_POINTS_PER_REQUEST):
            loc_seg = "+".join(f"{lat},{lon}" for lat, lon in pt_batch)
            param_frames = []
            for param_batch in _chunks(parameters, MAX_PARAMS_PER_REQUEST):
                url = f"{BASE_URL}/{time_seg}/{','.join(param_batch)}/{loc_seg}/csv"
                resp = requests.get(url, auth=auth, params=query, timeout=60)
                if resp.status_code != 200:
                    raise RuntimeError(f"Meteomatics API error ({resp.status_code}): {resp.text[:500]}")
                part = pd.read_csv(io.StringIO(resp.text), sep=";")
                # przy jednym punkcie API pomija kolumny lat/lon w CSV
                if "lat" not in part:
                    part.insert(0, "lat", pt_batch[0][0])
                    part.insert(1, "lon", pt_batch[0][1])
                part["lat"] = part["lat"].round(6)
                part["lon"] = part["lon"].round(6)
                param_frames.append(part)
                if pause_sec > 0:
                    time.sleep(pause_sec)

            merged = param_frames[0]
            for extra in param_frames[1:]:
                merged = merged.merge(extra, on=["lat", "lon", "validdate"], how="outer")
            frames.append(merged)

    df = pd.concat(frames, ignore_index=True)
    df["validdate"] = pd.to_datetime(df["validdate"], utc=True)
    df = df[["lat", "lon", "validdate"] + list(parameters)]

    if names:
        lookup = {(round(lat, 6), round(lon, 6)): n for (lat, lon), n in zip(points, names)}
        df.insert(0, "name", [lookup.get((la, lo)) for la, lo in zip(df["lat"], df["lon"])])
    return df.sort_values([c for c in ("name", "lat", "lon", "validdate") if c in df]).reset_index(drop=True)
