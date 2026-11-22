export type AppRouteKey = 'start' | 'report' | 'methodology' | 'apis';

interface TopHeaderProps {
  activeRoute: AppRouteKey;
  onNavigate: (path: string) => void;
}

const NAV_LINKS: Array<{ key: AppRouteKey; label: string; path: string }> = [
  { key: 'start', label: 'Sprawdź pole', path: '/' },
  { key: 'methodology', label: 'Jak to liczymy', path: '/metodyka' },
  { key: 'apis', label: 'Źródła danych', path: '/metodyka?tab=apis' }
];

export function TopHeader({ activeRoute, onNavigate }: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#DCE2DD] print:hidden">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="font-display text-lg font-bold tracking-tight text-[#141D19] whitespace-nowrap shrink-0 hover:text-[#1B5E4A] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5E4A]"
        >
          Water Buddy
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Nawigacja główna"
          className="flex items-center gap-4 sm:gap-7 text-xs sm:text-sm font-medium"
        >
          {NAV_LINKS.map((item) => {
            const isActive = activeRoute === item.key;
            return (
              <a
                key={item.key}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.path);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`py-1 border-b-2 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B5E4A] ${
                  isActive
                    ? 'border-[#1B5E4A] text-[#141D19] font-semibold'
                    : 'border-transparent text-[#506057] hover:text-[#141D19] hover:border-[#C5CFC8]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="hidden sm:flex items-center shrink-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#1B5E4A] text-white hover:bg-[#144B3A] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5E4A]"
          >
            Nowe sprawdzenie
          </a>
        </div>
      </div>
    </header>
  );
}
