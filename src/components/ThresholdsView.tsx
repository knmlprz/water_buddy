import { useState } from 'react';
import { Download, Code2, Check } from 'lucide-react';
import {
  EDO_LADDER,
  FLAT_THRESHOLDS_EXPORT,
  KBW_THRESHOLDS,
  NDVI_CLASSES,
  SOIL_WATER_GROUPS
} from '../data/thresholds';
import { arrayToCsv, triggerBrowserDownload } from '../utils/exporters';

export function ThresholdsView() {
  const [showJson, setShowJson] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const thresholdsBundle = {
    drabina_edo: EDO_LADDER,
    klasy_ndvi: NDVI_CLASSES,
    progi_kbw: KBW_THRESHOLDS,
    woda_w_glebie_0_50cm: SOIL_WATER_GROUPS
  };

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  return (
    <section aria-labelledby="thresholds-heading" className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#DCE2DD]">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-[#506057]">
            Tabela 2 · Progi decyzyjne i retencja · Źródła: POLSA 2024, CDR 2025, EDO, IUNG
          </p>
          <h1
            id="thresholds-heading"
            className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#141D19]"
          >
            Drabina EDO, klasy NDVI, progi KBW i woda w glebie
          </h1>
          <p className="text-sm text-[#43524A] leading-relaxed">
            Kompletny zestaw progów spójny z państwowym systemem IUNG SMSR oraz europejskim
            Copernicus EDO — gotowy do bezpośredniego użycia w silniku oceny stanu działki.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerBrowserDownload(
                'thresholds.json',
                JSON.stringify(thresholdsBundle, null, 2),
                'application/json;charset=utf-8'
              );
              notify('Pobrano thresholds.json');
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            thresholds.json
          </button>
          <button
            type="button"
            onClick={() => {
              triggerBrowserDownload(
                'thresholds.csv',
                arrayToCsv(FLAT_THRESHOLDS_EXPORT, true),
                'text/csv;charset=utf-8'
              );
              notify('Pobrano thresholds.csv');
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            thresholds.csv
          </button>
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            aria-expanded={showJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#141D19] text-white hover:bg-[#25332C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            {showJson ? 'Ukryj JSON' : 'Podgląd JSON'}
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs font-medium text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-3.5 py-2 rounded-lg"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {showJson && (
        <div className="bg-[#141D19] text-[#E6ECE8] rounded-lg border border-[#24322B] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#24322B] text-xs font-mono text-[#9BB0A4]">
            public/data/thresholds.json
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {JSON.stringify(thresholdsBundle, null, 2)}
          </pre>
        </div>
      )}

      {/* 1. Drabina alarmowa EDO */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-[#141D19]">
            01. Drabina alarmowa EDO (Combined Drought Indicator)
          </h2>
          <span className="text-xs text-[#5E6E65]">Źródło: POLSA 2024 (tab. 6.4), Copernicus EDO</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {EDO_LADDER.map((step, idx) => {
            const toneClass =
              step.poziom === 'brak'
                ? 'text-[#15803D]'
                : step.poziom === 'obserwacja'
                  ? 'text-[#A16207]'
                  : step.poziom === 'ostrzezenie'
                    ? 'text-[#C2410C]'
                    : 'text-[#B91C1C]';

            return (
              <div
                key={step.poziom}
                className="bg-white border border-[#DCE2DD] rounded-lg p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-[#5E6E65]">Poziom {idx}</span>
                    <span className={`font-semibold ${toneClass}`}>{step.nazwa_edo}</span>
                  </div>
                  <h3 className="text-sm font-bold text-[#141D19]">{step.nazwa_pl}</h3>
                  <p className="text-xs font-mono text-[#1F2E27] bg-[#F4F6F4] px-2.5 py-1.5 rounded-sm border border-[#E3E8E4]">
                    {step.warunek_logiczny}
                  </p>
                  <p className="text-xs text-[#43524A] leading-relaxed">{step.opis_dla_rolnika}</p>
                </div>
                <p className="text-[11px] text-[#697870] pt-2 border-t border-[#EDF1EE]">
                  {step.zrodlo}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Woda dostępna w glebie 0-50 cm (CDR tab. 12) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-[#141D19]">
            02. Woda dostępna w glebie 0–50 cm wg uziarnienia (model van Genuchtena)
          </h2>
          <span className="text-xs text-[#5E6E65]">
            Wzór: (PPW − Punkt więdnięcia) × 500 mm · Źródło: CDR 2025 tab. 12
          </span>
        </div>

        <div className="bg-white border border-[#DCE2DD] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F4F6F4] border-b border-[#DCE2DD] text-xs font-semibold text-[#43524A]">
                  <th className="py-3 px-4">Grupa glebowa</th>
                  <th className="py-3 px-4">Kategoria IUNG</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">PPW (% obj.)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">PHW (% obj.)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">PW (% obj.)</th>
                  <th className="py-3 px-4 min-w-[220px]">Woda dostępna w 0–50 cm</th>
                  <th className="py-3 px-4">Tempo przesychania</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7ECE8] text-sm">
                {SOIL_WATER_GROUPS.map((soil) => {
                  const pct = Math.round((soil.woda_dostepna_50cm_mm / 172) * 100);
                  return (
                    <tr key={soil.id} className="hover:bg-[#F9FAF9] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#141D19] whitespace-nowrap">
                        {soil.grupa_uziarnienia}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#43524A] whitespace-nowrap">
                        {soil.kategoria_iung}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {soil.ppw_pct_obj.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {soil.phw_pct_obj.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {soil.pw_pct_obj.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono tabular-nums font-bold text-[#141D19] w-16 shrink-0">
                            {soil.woda_dostepna_50cm_mm} mm
                          </span>
                          <div className="flex-1 h-2 bg-[#EAEFEA] rounded-xs overflow-hidden">
                            <div
                              className="h-full bg-[#1B5E4A]"
                              style={{ width: `${Math.max(pct, 5)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-[11px] font-mono text-[#64746B] mt-0.5 tabular-nums">
                          łatwo dostępna: ~{soil.woda_latwo_dostepna_50cm_mm} mm
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#314038] leading-snug">
                        {soil.tempo_przesychania}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3 & 4: Klasy NDVI oraz Progi KBW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-[#141D19]">03. Klasy NDVI i wskaźnik NDMI</h2>
            <span className="text-xs text-[#5E6E65]">POLSA 2024, s. 293</span>
          </div>

          <div className="bg-white border border-[#DCE2DD] rounded-lg divide-y divide-[#E7ECE8]">
            {NDVI_CLASSES.map((cls) => (
              <div key={cls.klasa} className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#141D19] capitalize">
                    {cls.klasa.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#1B5E4A]">
                    {cls.etykieta_zakresu}
                  </span>
                </div>
                <p className="text-xs text-[#2E3C35] leading-relaxed">{cls.interpretacja}</p>
                <p className="text-[11px] text-[#5E6E65] leading-relaxed">
                  {cls.uwaga_ndmi_fenologia}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-[#141D19]">
              04. Progi KBW (Klimatyczny Bilans Wodny)
            </h2>
            <span className="text-xs text-[#5E6E65]">CDR 2025 s. 66, IUNG SMSR</span>
          </div>

          <div className="bg-white border border-[#DCE2DD] rounded-lg divide-y divide-[#E7ECE8]">
            {KBW_THRESHOLDS.map((item) => (
              <div key={item.id} className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#141D19]">{item.poziom}</span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#B45309] shrink-0">
                    {item.zakres_mm}
                  </span>
                </div>
                <p className="text-xs text-[#2E3C35] leading-relaxed">
                  {item.znaczenie_agronomiczne}
                </p>
                <p className="text-[11px] text-[#5E6E65]">
                  Okno: {item.okno_czasowe} · {item.zrodlo}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
