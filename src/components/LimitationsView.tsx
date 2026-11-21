import { useMemo, useState } from 'react';
import { Copy, Check, Download, Code2 } from 'lucide-react';
import { LIMITATIONS_DATA, type LimitationSentence } from '../data/limitations';
import { arrayToCsv, triggerBrowserDownload } from '../utils/exporters';

export function LimitationsView() {
  const [category, setCategory] = useState<string>('Wszystkie');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  const categories = useMemo(
    () => ['Wszystkie', ...Array.from(new Set(LIMITATIONS_DATA.map((l) => l.kategoria)))],
    []
  );

  const filtered = useMemo(
    () =>
      LIMITATIONS_DATA.filter((l) => category === 'Wszystkie' || l.kategoria === category),
    [category]
  );

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback ignored in restricted contexts
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllSection = () => {
    const markdown = [
      '## Ograniczenia analizy i niepewność wyników',
      '',
      ...filtered.map((item) => `- **${item.kategoria}:** ${item.zdanie_do_raportu}`)
    ].join('\n');
    copyText(markdown, 'ALL');
  };

  return (
    <section aria-labelledby="limitations-heading" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#DCE2DD]">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-[#506057]">
            Tabela 4 · Sekcja „Ograniczenia” raportu · Wiarygodność (25% oceny jury KOWR)
          </p>
          <h1
            id="limitations-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141D19] [text-wrap:balance]"
          >
            Gotowe zdania do sekcji „Ograniczenia” raportu
          </h1>
          <p className="text-sm text-[#43524A] leading-relaxed">
            Komunikują wprost aktualność zobrazowań satelitarnych, różnice rozdzielczości (1 m vs
            5 km), brak prognozy straty plonu w procentach oraz czynniki polowe nieuwzględnione w
            danych otwartych.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={copyAllSection}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#1B5E4A] text-white hover:bg-[#144B3A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedId === 'ALL' ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {copiedId === 'ALL' ? 'Skopiowano sekcję' : 'Kopiuj sekcję Markdown'}
          </button>
          <button
            type="button"
            onClick={() =>
              triggerBrowserDownload(
                'limitations.json',
                JSON.stringify(LIMITATIONS_DATA, null, 2),
                'application/json;charset=utf-8'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            limitations.json
          </button>
          <button
            type="button"
            onClick={() =>
              triggerBrowserDownload(
                'limitations.csv',
                arrayToCsv(LIMITATIONS_DATA, true),
                'text/csv;charset=utf-8'
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            limitations.csv
          </button>
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            aria-expanded={showJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#141D19] text-white hover:bg-[#25332C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            {showJson ? 'Ukryj JSON' : 'JSON'}
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div
        role="group"
        aria-label="Filtr kategorii ograniczeń"
        className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFEA] rounded-lg w-fit"
      >
        {categories.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-white text-[#141D19] shadow-xs font-semibold'
                  : 'text-[#4B5A52] hover:text-[#141D19]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {showJson && (
        <div className="bg-[#141D19] text-[#E6ECE8] rounded-lg border border-[#24322B] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#24322B] text-xs font-mono text-[#9BB0A4]">
            public/data/limitations.json ({LIMITATIONS_DATA.length} zdań)
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {JSON.stringify(LIMITATIONS_DATA, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-white border border-[#DCE2DD] rounded-lg divide-y divide-[#E4EAE6]">
        {filtered.map((item: LimitationSentence) => (
          <div
            key={item.id}
            className="p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4 hover:bg-[#FAFBF9] transition-colors"
          >
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#55665D]">
                <span className="font-mono font-semibold text-[#1B5E4A]">{item.id}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#2B3A32]">{item.kategoria}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px] text-[#5E6E65]">
                  warunek: {item.warunek_kod}
                </span>
              </div>

              <p className="text-sm text-[#141D19] leading-relaxed">{item.zdanie_do_raportu}</p>

              <p className="text-xs text-[#5E6E65]">
                Kiedy dołączyć: {item.kiedy_stosowac} · Podstawa: {item.zrodlo_lub_podstawa}
              </p>
            </div>

            <button
              type="button"
              onClick={() => copyText(item.zdanie_do_raportu, item.id)}
              aria-label={`Kopiuj zdanie ${item.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#CED7D1] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              {copiedId === item.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                  Skopiowano
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  Kopiuj zdanie
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
