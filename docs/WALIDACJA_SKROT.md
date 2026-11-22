# Walidacja Water Buddy z IUNG SMSR (2025)

Punkt odniesienia: **IUNG-PIB, System Monitoringu Suszy Rolniczej**, czyli urzędowe progi KBW wg Rozp. MRiRW z 11.04.2019.

| | **A — susza** | **B — anomalia, bez suszy** | **C — stabilnie** |
|---|---|---|---|
| Działka | `080503_5.0006.74/4` | `040704_2.0004.70/11` | `060404_2.0177.13/4` |
| Gmina | Ośno Lubuskie | Inowrocław | Hrubieszów |
| Uprawa · data | jęczmień jary · 30.06.2025 | pszenica ozima · 10.07.2025 | burak cukrowy · 31.07.2025 |
| Gleba (kat. IUNG) | I (piasek) | IV (less) | IV (less) |
| **IUNG mówi** | **susza**, 96% pow. gminy | **brak suszy**, 0% | **brak suszy**, 0% |
| **Water Buddy: KBW / próg** | **−154 / −142 mm** | **−168 / −251 mm** | **−57 / −266 mm** |
| Werdykt aplikacji | 🔴 susza **TAK** | 🟢 susza **NIE** + „mniej deszczu niż zwykle” | 🟢 susza **NIE**, „opady w normie” |
| Podlewać? | TAK (~10 mm) | NIE | NIE |
| Zgodność z IUNG | ✅ | ✅ | ✅ |

Water Buddy liczy KBW z ERA5 w punkcie działki, a IUNG dla całej gminy. Różnica kilkunastu mm jest więc normalna. Zgodność oznacza, że oba wyniki leżą po tej samej stronie progu suszy.

Źródła: [Ośno](https://susza.iung.pulawy.pl/wykazy/2025,0805033/) · [Inowrocław](https://susza.iung.pulawy.pl/wykazy/2025,0407042/) · [Hrubieszów](https://susza.iung.pulawy.pl/wykazy/2025,0604042/) · [progi KBW](https://susza.iung.pulawy.pl/progi/) · szczegóły: [WALIDACJA_IUNG.md](WALIDACJA_IUNG.md)
