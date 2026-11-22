import { CropsView } from '../components/CropsView';
import { ThresholdsView } from '../components/ThresholdsView';
import { RulesView } from '../components/RulesView';
import { LimitationsView } from '../components/LimitationsView';
import { ApiSourcesView } from '../components/ApiSourcesView';
import { SimulatorView } from '../components/SimulatorView';

export type MethodologyTab =
  | 'crops'
  | 'thresholds'
  | 'rules'
  | 'limitations'
  | 'apis'
  | 'simulator';

interface MethodologyPageProps {
  activeTab: MethodologyTab;
  onSelectTab: (tab: MethodologyTab) => void;
}

const SUB_TABS: Array<{ id: MethodologyTab; label: string }> = [
  { id: 'crops', label: 'Uprawy i okna wody' },
  { id: 'thresholds', label: 'Progi i rodzaje gleb' },
  { id: 'rules', label: 'Zasady podpowiedzi' },
  { id: 'limitations', label: 'Ograniczenia' },
  { id: 'apis', label: 'Źródła danych' }
];

const STATIC_FILES = [
  'crops.json',
  'crops.csv',
  'thresholds.json',
  'thresholds.csv',
  'soil_water_groups.csv',
  'rules.json',
  'rules.csv',
  'limitations.json',
  'limitations.csv',
  'api_sources.json',
  'api_sources.csv',
  'README_ZRODLA_I_LICENCJE.md'
];

export function MethodologyPage({ activeTab, onSelectTab }: MethodologyPageProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#DCE2DD] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#141D19]">
              Jak to liczymy i skąd bierzemy dane
            </h1>
            <p className="text-sm text-[#55665D] mt-0.5">
              Tutaj możesz sprawdzić wszystkie tabele upraw, progi wilgotności, reguły doradcze oraz
              listę publicznych źródeł danych, z których korzysta Water Buddy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('simulator')}
            className={`text-xs font-semibold hover:underline cursor-pointer ${
              activeTab === 'simulator' ? 'text-[#141D19] underline' : 'text-[#1B5E4A]'
            }`}
          >
            Symulator scenariuszy (dla doradców) →
          </button>
        </div>

        <nav
          aria-label="Zakładki metodyki"
          className="flex flex-wrap items-center gap-1.5 border-t border-[#E6EBE7] pt-3"
        >
          {SUB_TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1B5E4A] text-white'
                    : 'text-[#4A5A52] hover:bg-[#EDF2EE] hover:text-[#141D19]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-[#617068] border-t border-[#E6EBE7] pt-3">
          <span>Eksport tabel (/data/):</span>
          {STATIC_FILES.map((file) => (
            <a
              key={file}
              href={`/data/${file}`}
              download={file}
              className="text-[#1B5E4A] hover:underline"
            >
              {file}
            </a>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'crops' && <CropsView />}
        {activeTab === 'thresholds' && <ThresholdsView />}
        {activeTab === 'rules' && <RulesView />}
        {activeTab === 'limitations' && <LimitationsView />}
        {activeTab === 'apis' && <ApiSourcesView />}
        {activeTab === 'simulator' && <SimulatorView />}
      </div>
    </div>
  );
}
