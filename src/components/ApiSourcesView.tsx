import { useMemo, useState } from 'react';
import { Play, Copy, Check, Download, RefreshCw } from 'lucide-react';
import { API_SOURCES_DATA, type ApiSourceSpec } from '../data/apiSources';
import {
  arrayToCsv,
  generateReadmeSourcesMarkdown,
  triggerBrowserDownload
} from '../utils/exporters';

interface LiveProbeResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  url: string;
  method: string;
  summary: string;
  snippet?: string;
  error?: string;
}

export function ApiSourcesView() {
  const [subView, setSubView] = useState<'verifier' | 'readme'>('verifier');
  const [probeResults, setProbeResults] = useState<Record<string, LiveProbeResult>>({});
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Test parameters sent to allowlisted Express backend
  const [testLat, setTestLat] = useState('52.8000');
  const [testLon, setTestLon] = useState('18.2500');
  const [testDate, setTestDate] = useState('2024-06-20');

  const readmeMarkdown = useMemo(() => generateReadmeSourcesMarkdown(API_SOURCES_DATA), []);

  const runProbe = async (sourceId: string) => {
    setLoadingIds((prev) => ({ ...prev, [sourceId]: true }));
    try {
      const params = new URLSearchParams({
        lat: testLat,
        lon: testLon,
        date: testDate
      });
      const res = await fetch(`/api/probe/${encodeURIComponent(sourceId)}?${params.toString()}`);
      const data = (await res.json()) as LiveProbeResult;
      setProbeResults((prev) => ({ ...prev, [sourceId]: data }));
    } catch (err) {
      setProbeResults((prev) => ({
        ...prev,
        [sourceId]: {
          ok: false,
          status: 0,
          latencyMs: 0,
          url: '',
          method: 'GET',
          summary: 'Nie udało się połączyć z backendem weryfikatora',
          error: err instanceof Error ? err.message : 'Błąd sieci'
        }
      }));
    } finally {
      setLoadingIds((prev) => ({ ...prev, [sourceId]: false }));
    }
  };

  const runAllProbes = async () => {
    setBatchRunning(true);
    await Promise.all(API_SOURCES_DATA.map((src) => runProbe(src.id)));
    setBatchRunning(false);
  };

  const copyValue = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard fallback ignored
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section aria-labelledby="apis-heading" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#DCE2DD]">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-[#506057]">
            Dane i API · Ręcznie zweryfikowane endpointy · Gotowa tabela licencji do README
          </p>
          <h1
            id="apis-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141D19] [text-wrap:balance]"
          >
            Weryfikator otwartych API i tabela źródeł do README
          </h1>
          <p className="text-sm text-[#43524A] leading-relaxed">
            Każde źródło (ULDK, Open-Meteo Archive, Earth Search Sentinel-2, IUNG GeoServer, NMT
            1 m, BDOT10k / Hydroportal, EDO WMS, IMGW) ma działający URL, przykładową odpowiedź,
            limity, licencję oraz test na żywo przez serwer proxy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              triggerBrowserDownload(
                'api_sources.json',
                JSON.stringify(API_SOURCES_DATA, null, 2),
                'application/json;charset=utf-8'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            api_sources.json
          </button>
          <button
            type="button"
            onClick={() =>
              triggerBrowserDownload(
                'api_sources.csv',
                arrayToCsv(API_SOURCES_DATA, true),
                'text/csv;charset=utf-8'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            api_sources.csv
          </button>
          <button
            type="button"
            onClick={() =>
              triggerBrowserDownload(
                'README_ZRODLA_I_LICENCJE.md',
                readmeMarkdown,
                'text/markdown;charset=utf-8'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#141D19] text-white hover:bg-[#25332C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            README (.md)
          </button>
        </div>
      </div>

      {/* Sub-view segmented switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Widok źródeł API"
          className="inline-flex items-center gap-1 p-1 bg-[#EAEFEA] rounded-lg w-fit"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subView === 'verifier'}
            onClick={() => setSubView('verifier')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subView === 'verifier'
                ? 'bg-white text-[#141D19] shadow-xs'
                : 'text-[#4B5A52] hover:text-[#141D19]'
            }`}
          >
            Weryfikator i przykłady ({API_SOURCES_DATA.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subView === 'readme'}
            onClick={() => setSubView('readme')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subView === 'readme'
                ? 'bg-white text-[#141D19] shadow-xs'
                : 'text-[#4B5A52] hover:text-[#141D19]'
            }`}
          >
            Tabela źródeł i licencji do README
          </button>
        </div>

        {subView === 'verifier' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[#43524A]">
              <span>Lat</span>
              <input
                type="text"
                value={testLat}
                onChange={(e) => setTestLat(e.target.value)}
                className="w-20 px-2 py-1.5 text-xs font-mono bg-white border border-[#CED7D1] rounded-md text-[#141D19]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#43524A]">
              <span>Lon</span>
              <input
                type="text"
                value={testLon}
                onChange={(e) => setTestLon(e.target.value)}
                className="w-20 px-2 py-1.5 text-xs font-mono bg-white border border-[#CED7D1] rounded-md text-[#141D19]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#43524A]">
              <span>Data X</span>
              <input
                type="date"
                value={testDate}
                min="2015-01-01"
                max="2026-11-21"
                onChange={(e) => setTestDate(e.target.value)}
                className="px-2 py-1.5 text-xs font-mono bg-white border border-[#CED7D1] rounded-md text-[#141D19]"
              />
            </label>
            <button
              type="button"
              disabled={batchRunning}
              onClick={runAllProbes}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#1B5E4A] text-white hover:bg-[#144B3A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${batchRunning ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {batchRunning ? 'Testowanie...' : 'Testuj wszystkie źródła'}
            </button>
          </div>
        )}
      </div>

      {subView === 'verifier' ? (
        <div className="bg-white border border-[#DCE2DD] rounded-lg divide-y divide-[#E4EAE6]">
          {API_SOURCES_DATA.map((src: ApiSourceSpec) => {
            const live = probeResults[src.id];
            const isLoading = Boolean(loadingIds[src.id]);
            const isVerified = src.status_weryfikacji.startsWith('Zweryfikowane');

            return (
              <article key={src.id} className="p-5 space-y-3.5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#55665D]">
                      <span className="font-semibold text-[#1B5E4A]">{src.kategoria_kowr}</span>
                      <span aria-hidden="true">·</span>
                      <span>{src.dostawca}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isVerified
                            ? 'text-[#15803D] font-semibold'
                            : 'text-[#B45309] font-semibold'
                        }
                      >
                        {isVerified ? '● ' : '▲ '}
                        {src.status_weryfikacji}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-[#141D19]">{src.nazwa}</h2>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyValue(src.url_przykladowy, `url_${src.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#CED7D1] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedKey === `url_${src.id}` ? (
                        <Check className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {copiedKey === `url_${src.id}` ? 'Skopiowano URL' : 'Kopiuj URL'}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => runProbe(src.id)}
                      aria-label={`Przetestuj na żywo ${src.nazwa}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#1B5E4A] text-white hover:bg-[#144B3A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      {isLoading ? 'Wysyłanie...' : 'Przetestuj na żywo'}
                    </button>
                  </div>
                </div>

                {/* Working query URL & optional POST body */}
                <div className="bg-[#F4F6F4] border border-[#E3E8E4] rounded-md p-3 space-y-2 text-xs font-mono">
                  <div className="break-all text-[#141D19]">
                    <span className="font-bold text-[#1B5E4A] mr-2">{src.metoda}</span>
                    {src.url_przykladowy}
                  </div>
                  {src.body_przykladowe && (
                    <div className="pt-2 border-t border-[#E0E6E2] text-[#35463D] break-all">
                      <span className="font-semibold text-[#55665D] mr-2">BODY:</span>
                      {src.body_przykladowe}
                    </div>
                  )}
                </div>

                {/* Live Probe Output */}
                {live && (
                  <div
                    role="status"
                    className={`rounded-md border p-3.5 space-y-2 text-xs ${
                      live.ok
                        ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#14532D]'
                        : 'bg-[#FEF2F2] border-[#FECACA] text-[#7F1D1D]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums font-semibold">
                      <span>
                        {live.ok ? '● HTTP ' : '✖ HTTP '}
                        {live.status} · Czas odpowiedzi: {live.latencyMs} ms
                      </span>
                      <span>{live.summary}</span>
                    </div>
                    {live.snippet && (
                      <pre className="bg-white/80 border border-black/10 rounded-xs p-2.5 text-[11px] font-mono text-[#141D19] overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                        {live.snippet}
                      </pre>
                    )}
                    {live.error && <p className="font-medium">{live.error}</p>}
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[#64746B] block font-medium mb-0.5">
                      Dane historyczne (10 lat)
                    </span>
                    <span className="text-[#1D2923]">{src.dane_historyczne_10_lat}</span>
                  </div>
                  <div>
                    <span className="text-[#64746B] block font-medium mb-0.5">Rozdzielczość</span>
                    <span className="text-[#1D2923]">{src.rozdzielczosc}</span>
                  </div>
                  <div>
                    <span className="text-[#64746B] block font-medium mb-0.5">
                      Limity i klucz API
                    </span>
                    <span className="text-[#1D2923]">{src.limity_i_klucz}</span>
                  </div>
                  <div>
                    <span className="text-[#64746B] block font-medium mb-0.5">Licencja</span>
                    <span className="text-[#1D2923]">{src.licencja}</span>
                  </div>
                </div>

                {/* Verified Sample Response & Operator Note */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-[#FAFBF9] border border-[#E7ECE8] rounded-md p-3">
                    <span className="text-[#5E6E65] block font-medium mb-1">
                      Sprawdzona przykładowa odpowiedź ({src.format_odpowiedzi})
                    </span>
                    <code className="font-mono text-[11px] text-[#23322B] break-all block leading-relaxed">
                      {src.przykladowa_odpowiedz}
                    </code>
                  </div>
                  <div className="bg-[#FAFBF9] border border-[#E7ECE8] rounded-md p-3">
                    <span className="text-[#5E6E65] block font-medium mb-1">
                      Notatka dla operatora / backendu
                    </span>
                    <p className="text-[#23322B] leading-relaxed">{src.uwagi_dla_operatora}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-[#DCE2DD] rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#F4F6F4] border-b border-[#DCE2DD] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#141D19]">
                Podgląd tabeli źródeł i licencji (pkt 4 i 5.3 regulaminu KOWR)
              </span>
              <button
                type="button"
                onClick={() => copyValue(readmeMarkdown, 'readme_md')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#1B5E4A] text-white hover:bg-[#144B3A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'readme_md' ? (
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {copiedKey === 'readme_md' ? 'Skopiowano Markdown' : 'Kopiuj Markdown do README'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DCE2DD] text-[#43524A] font-semibold bg-[#FAFBF9]">
                    <th className="py-2.5 px-3.5">Kategoria</th>
                    <th className="py-2.5 px-3.5">Źródło</th>
                    <th className="py-2.5 px-3.5">Tryb pobierania</th>
                    <th className="py-2.5 px-3.5">Archiwum 10 lat</th>
                    <th className="py-2.5 px-3.5">Licencja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7ECE8]">
                  {API_SOURCES_DATA.map((src) => (
                    <tr key={src.id} className="align-top">
                      <td className="py-3 px-3.5 font-medium text-[#1B5E4A] whitespace-nowrap">
                        {src.kategoria_kowr}
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-[#141D19] min-w-[200px]">
                        {src.nazwa}
                        <div className="text-[11px] font-normal text-[#5E6E65] mt-0.5">
                          {src.dostawca}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-[#2B3A32] whitespace-nowrap">
                        {src.pobieranie_tryb}
                      </td>
                      <td className="py-3 px-3.5 text-[#2B3A32] min-w-[200px]">
                        {src.dane_historyczne_10_lat}
                      </td>
                      <td className="py-3 px-3.5 text-[#2B3A32] min-w-[240px]">{src.licencja}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#141D19] text-[#E6ECE8] rounded-lg border border-[#24322B] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#24322B] flex items-center justify-between text-xs font-mono text-[#9BB0A4]">
              <span>public/data/README_ZRODLA_I_LICENCJE.md</span>
              <span>Gotowe do wklejenia w README.md</span>
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto max-h-[420px] leading-relaxed whitespace-pre-wrap">
              {readmeMarkdown}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
