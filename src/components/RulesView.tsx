import { useMemo, useState } from 'react';
import { Download, Search, Code2, Check } from 'lucide-react';
import { RECOMMENDATION_RULES, type KowrCategory } from '../data/rules';
import { arrayToCsv, triggerBrowserDownload } from '../utils/exporters';

const CATEGORY_TABS: Array<{ id: 'Wszystkie' | KowrCategory; label: string }> = [
  { id: 'Wszystkie', label: 'Wszystkie (16)' },
  { id: 'Ograniczenie / weryfikacja', label: '1. Weryfikacja' },
  { id: 'Retencja krajobrazowa (NWRM)', label: '2. Retencja krajobrazowa' },
  { id: 'Retencja glebowa i agrotechnika', label: '3. Agrotechnika' },
  { id: 'Nawadnianie (opcjonalne)', label: '4. Nawadnianie' }
];

export function RulesView() {
  const [category, setCategory] = useState<'Wszystkie' | KowrCategory>('Wszystkie');
  const [query, setQuery] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RECOMMENDATION_RULES.filter((rule) => {
      const matchesCat = category === 'Wszystkie' || rule.kategoria_kowr === category;
      const matchesQuery =
        !q ||
        rule.id.toLowerCase().includes(q) ||
        rule.tytul.toLowerCase().includes(q) ||
        rule.warunek_czytelny.toLowerCase().includes(q) ||
        rule.tekst_dla_rolnika.toLowerCase().includes(q) ||
        rule.przyczyna.toLowerCase().includes(q) ||
        rule.zrodlo.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [category, query]);

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  return (
    <section aria-labelledby="rules-heading" className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#DCE2DD]">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-[#506057]">
            Tabela 3 · Reguły „przyczyna → rekomendacja” · Ton doradczy „można rozważyć”
          </p>
          <h1
            id="rules-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141D19] [text-wrap:balance]"
          >
            Baza reguł decyzyjnych w obowiązkowej kolejności KOWR
          </h1>
          <p className="text-sm text-[#43524A] leading-relaxed">
            Każda reguła wiąże konkretną przyczynę i mierzalny warunek z propozycją dla rolnika
            (bez tonu nakazowego), naukowym uzasadnieniem oraz źródłem. Kolejność: weryfikacja →
            retencja krajobrazowa → agrotechnika → opcjonalne nawadnianie.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerBrowserDownload(
                'rules.json',
                JSON.stringify(RECOMMENDATION_RULES, null, 2),
                'application/json;charset=utf-8'
              );
              notify('Pobrano rules.json');
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            rules.json
          </button>
          <button
            type="button"
            onClick={() => {
              triggerBrowserDownload(
                'rules.csv',
                arrayToCsv(RECOMMENDATION_RULES, true),
                'text/csv;charset=utf-8'
              );
              notify('Pobrano rules.csv');
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#C8D2CB] bg-white text-[#141D19] hover:bg-[#F1F4F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            rules.csv
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

      {/* Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtr kategorii KOWR"
          className="flex flex-wrap items-center gap-1 p-1 bg-[#EAEFEA] rounded-lg w-fit"
        >
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#141D19] shadow-xs font-semibold'
                    : 'text-[#4B5A52] hover:text-[#141D19]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full xl:w-80">
          <Search
            className="w-4 h-4 text-[#6B7A72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Szukaj reguły"
            placeholder="Szukaj warunku, np. spadek, mulcz, Natura..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#CED7D1] rounded-lg text-[#141D19] placeholder:text-[#78877E] focus:outline-none focus:border-[#1B5E4A]"
          />
        </div>
      </div>

      {showJson && (
        <div className="bg-[#141D19] text-[#E6ECE8] rounded-lg border border-[#24322B] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#24322B] text-xs font-mono text-[#9BB0A4]">
            public/data/rules.json ({RECOMMENDATION_RULES.length} reguł)
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {JSON.stringify(RECOMMENDATION_RULES, null, 2)}
          </pre>
        </div>
      )}

      {/* Structured Rules List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#DCE2DD] rounded-lg py-12 px-6 text-center text-sm text-[#5A6A61]">
          Brak reguł pasujących do filtra.{' '}
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('Wszystkie');
            }}
            className="underline font-semibold text-[#1B5E4A] ml-1 cursor-pointer"
          >
            Pokaż wszystkie reguły
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#DCE2DD] rounded-lg divide-y divide-[#E4EAE6]">
          {filtered.map((rule) => (
            <article key={rule.id} className="p-5 space-y-3 hover:bg-[#FAFBF9] transition-colors">
              {/* Unboxed quiet metadata line */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#55665D]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-[#1B5E4A]">{rule.id}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#2A3931]">
                    Krok {rule.kolejnosc_kowr}: {rule.kategoria_kowr}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Przyczyna: {rule.przyczyna}</span>
                </div>
                <span className="text-[#697870]">{rule.zrodlo}</span>
              </div>

              <h2 className="text-base font-bold text-[#141D19]">{rule.tytul}</h2>

              {/* Condition strip */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#F4F6F4] border border-[#E3E8E4] rounded-md px-3 py-2">
                  <span className="text-[#5E6E65] block text-[11px] font-medium mb-0.5">
                    Warunek merytoryczny
                  </span>
                  <span className="font-mono text-[#141D19]">{rule.warunek_czytelny}</span>
                </div>
                <div className="bg-[#F4F6F4] border border-[#E3E8E4] rounded-md px-3 py-2">
                  <span className="text-[#5E6E65] block text-[11px] font-medium mb-0.5">
                    Predykat (kod silnika)
                  </span>
                  <span className="font-mono text-[#1B5E4A]">{rule.warunek_kod}</span>
                </div>
              </div>

              {/* Farmer copy & Scientific rationale */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
                <div className="lg:col-span-7 space-y-1">
                  <p className="text-xs font-semibold text-[#141D19]">
                    Tekst dla rolnika („można rozważyć”)
                  </p>
                  <p className="text-sm text-[#1E2A24] leading-relaxed">
                    {rule.tekst_dla_rolnika}
                  </p>
                </div>
                <div className="lg:col-span-5 space-y-1 lg:pl-4 lg:border-l lg:border-[#E7ECE8]">
                  <p className="text-xs font-semibold text-[#43524A]">Uzasadnienie naukowe</p>
                  <p className="text-xs text-[#4C5C54] leading-relaxed">
                    {rule.uzasadnienie_naukowe}
                  </p>
                  <p className="text-xs text-[#1B5E4A] font-medium pt-1">
                    Opcja do dodania: {rule.co_dodac_krotko}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
