import { useMemo, useState } from 'react';
import { Download, Search, Code2, Check } from 'lucide-react';
import { CROPS_DATA, type CropParameter } from '../data/crops';
import { arrayToCsv, triggerBrowserDownload } from '../utils/exporters';

const MONTHS = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

function mmddToPercent(mmdd: string): number {
  const [mStr, dStr] = mmdd.split('-');
  const m = Number(mStr) - 1;
  const d = Number(dStr) - 1;
  const dayOfYear = m * 30.4 + d;
  return Math.min(Math.max((dayOfYear / 365) * 100, 0), 100);
}

export function CropsView() {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('Wszystkie');
  const [showJson, setShowJson] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const groups = useMemo(
    () => ['Wszystkie', ...Array.from(new Set(CROPS_DATA.map((c) => c.grupa)))],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CROPS_DATA.filter((crop) => {
      const matchesGroup = groupFilter === 'Wszystkie' || crop.grupa === groupFilter;
      const matchesQuery =
        !q ||
        crop.nazwa_pl.toLowerCase().includes(q) ||
        crop.nazwa_en.toLowerCase().includes(q) ||
        crop.okno_krytyczne_opis.toLowerCase().includes(q) ||
        crop.zrodlo.toLowerCase().includes(q);
      return matchesGroup && matchesQuery;
    });
  }, [query, groupFilter]);

  const handleDownloadJson = () => {
    triggerBrowserDownload(
      'crops.json',
      JSON.stringify(CROPS_DATA, null, 2),
      'application/json;charset=utf-8'
    );
    setDownloadNotice('Pobrano crops.json');
    setTimeout(() => setDownloadNotice(null), 2500);
  };

  const handleDownloadCsv = () => {
    triggerBrowserDownload('crops.csv', arrayToCsv(CROPS_DATA, true), 'text/csv;charset=utf-8');
    setDownloadNotice('Pobrano crops.csv (UTF-8)');
    setTimeout(() => setDownloadNotice(null), 2500);
  };

  return (
    <section aria-labelledby="crops-heading" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#DCE2DD]">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-[#506057]">
            Tabela 1 · Baza merytoryczna · Źródła: CDR 2025, FAO-56, IUNG SMSR
          </p>
          <h1
            id="crops-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141D19] [text-wrap:balance]"
          >
            Parametry wodne 8 kluczowych upraw w Polsce
          </h1>
          <p className="text-sm text-[#43524A] leading-relaxed">
            Okna krytyczne zapotrzebowania na wodę, progi dopuszczalnego wyczerpania zapasu (p),
            głębokość strefy korzeniowej, współczynniki Kc oraz okna zbiorów chroniące przed
            fałszywym alarmem NDVI w czasie żniw.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Pobierz crops.json
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Pobierz crops.csv
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

      {downloadNotice && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs font-medium text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-3.5 py-2 rounded-lg"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{downloadNotice} — plik jest także zapisany w repozytorium pod public/data/.</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtr grupy upraw"
          className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFEA] rounded-lg w-fit"
        >
          {groups.map((grp) => {
            const active = groupFilter === grp;
            return (
              <button
                key={grp}
                type="button"
                onClick={() => setGroupFilter(grp)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#141D19] shadow-xs font-semibold'
                    : 'text-[#4B5A52] hover:text-[#141D19]'
                }`}
              >
                {grp}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="w-4 h-4 text-[#6B7A72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Szukaj uprawy"
            placeholder="Szukaj uprawy, fazy lub źródła..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#CED7D1] rounded-lg text-[#141D19] placeholder:text-[#78877E] focus:outline-none focus:border-[#1B5E4A]"
          />
        </div>
      </div>

      {showJson && (
        <div className="bg-[#141D19] text-[#E6ECE8] rounded-lg border border-[#24322B] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#24322B] flex items-center justify-between text-xs text-[#9BB0A4]">
            <span className="font-mono">public/data/crops.json</span>
            <span className="font-mono tabular-nums">{CROPS_DATA.length} rekordów</span>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {JSON.stringify(CROPS_DATA, null, 2)}
          </pre>
        </div>
      )}

      {/* Main High-Density Agronomic Table */}
      <div className="bg-white border border-[#DCE2DD] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F6F4] border-b border-[#DCE2DD] text-xs font-semibold text-[#43524A]">
                <th className="py-3 px-4">Uprawa i grupa</th>
                <th className="py-3 px-4">Okno krytyczne (CDR / IUNG)</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Wyczerpanie (p)</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Korzenie (m)</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Kc (ini / mid / end)</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">KBW kat. I / II</th>
                <th className="py-3 px-4">Fenologia i źródło</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7ECE8] text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-[#5A6A61]">
                    Brak upraw pasujących do filtra „{query}”.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setGroupFilter('Wszystkie');
                      }}
                      className="underline font-medium text-[#1B5E4A] ml-1 cursor-pointer"
                    >
                      Wyczyść filtry
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((crop: CropParameter) => {
                  const critLeft = mmddToPercent(crop.okno_start_mmdd);
                  const critWidth = Math.max(
                    mmddToPercent(crop.okno_koniec_mmdd) - critLeft,
                    6
                  );
                  const harvLeft = mmddToPercent(crop.okno_zbior_start_mmdd);
                  const harvWidth = Math.max(
                    mmddToPercent(crop.okno_zbior_koniec_mmdd) - harvLeft,
                    5
                  );

                  return (
                    <tr
                      key={crop.id}
                      className="hover:bg-[#F9FAF9] transition-colors align-top"
                    >
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="font-semibold text-[#141D19]">{crop.nazwa_pl}</div>
                        <div className="text-xs text-[#5E6E65] mt-0.5">
                          {crop.grupa} · Wrażliwość: {crop.wrazliwosc_na_susze}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 min-w-[260px]">
                        <div className="text-xs text-[#1D2923] leading-snug">
                          {crop.okno_krytyczne_opis}
                        </div>
                        <div className="text-[11px] text-[#5E6E65] mt-1">
                          Gleba lekka: {crop.okno_krytyczne_gleba_lekka}
                        </div>
                        {/* Mini Phenology Bar (Critical vs Harvest window) */}
                        <div className="mt-2 space-y-1">
                          <div
                            className="relative h-2 bg-[#ECEFEA] rounded-xs overflow-hidden"
                            title={`Okno krytyczne: ${crop.okno_start_mmdd}–${crop.okno_koniec_mmdd} | Zbiór: ${crop.okno_zbior_start_mmdd}–${crop.okno_zbior_koniec_mmdd}`}
                          >
                            <div
                              className="absolute top-0 bottom-0 bg-[#1B5E4A]"
                              style={{ left: `${critLeft}%`, width: `${critWidth}%` }}
                            />
                            <div
                              className="absolute top-0 bottom-0 bg-[#B45309]/55"
                              style={{ left: `${harvLeft}%`, width: `${harvWidth}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-[#6F7E75]">
                            <span>{MONTHS[0]}</span>
                            <span>{MONTHS[4]}</span>
                            <span>{MONTHS[7]}</span>
                            <span>{MONTHS[11]}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-[#141D19]">
                          {Math.round(crop.dopuszczalne_wyczerpanie_p * 100)}%
                        </span>
                        <div className="text-[11px] text-[#5E6E65]">
                          p = {crop.dopuszczalne_wyczerpanie_p.toFixed(2)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-[#141D19]">
                          {crop.glebokosc_korzeni_min_m.toFixed(1)}–
                          {crop.glebokosc_korzeni_max_m.toFixed(1)}
                        </span>
                        <div className="text-[11px] text-[#5E6E65]">
                          efekt. {crop.glebokosc_efektywna_m.toFixed(1)} m
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-xs text-[#2B3932]">
                        {crop.kc_ini.toFixed(2)} / {crop.kc_mid.toFixed(2)} /{' '}
                        {crop.kc_end.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-xs">
                        <span className="text-[#B45309] font-semibold">
                          {crop.prog_kbw_kat1_mm}
                        </span>
                        <span className="text-[#78877E]"> / </span>
                        <span className="text-[#2B3932]">{crop.prog_kbw_kat2_mm} mm</span>
                      </td>

                      <td className="py-3.5 px-4 min-w-[230px]">
                        <p className="text-xs text-[#314038] leading-relaxed">
                          {crop.uwagi_fenologiczne}
                        </p>
                        <p className="text-[11px] text-[#64746B] mt-1 font-medium">{crop.zrodlo}</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 bg-[#F9FAF9] border-t border-[#E7ECE8] flex flex-wrap items-center justify-between gap-3 text-xs text-[#526259]">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2 bg-[#1B5E4A] inline-block rounded-xs" />
              Okno krytyczne wody
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2 bg-[#B45309]/60 inline-block rounded-xs" />
              Typowe okno zbioru / pokosów (ochrona NDVI)
            </span>
          </div>
          <span className="font-mono tabular-nums">
            Wyświetlono {filtered.length} z {CROPS_DATA.length} upraw
          </span>
        </div>
      </div>
    </section>
  );
}
