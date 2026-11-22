import { useEffect, useState } from 'react';
import { TopHeader, type AppRouteKey } from './components/TopHeader';
import { StartPage } from './pages/StartPage';
import { ReportPage } from './pages/ReportPage';
import { MethodologyPage, type MethodologyTab } from './pages/MethodologyPage';

interface RouteState {
  pathname: string;
  search: string;
}

function readLocation(): RouteState {
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || ''
  };
}

function parseMethodologyTab(pathname: string, search: string): MethodologyTab {
  if (pathname.startsWith('/metodyka/symulator')) return 'simulator';
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (
    tab === 'crops' ||
    tab === 'thresholds' ||
    tab === 'rules' ||
    tab === 'limitations' ||
    tab === 'apis' ||
    tab === 'simulator'
  ) {
    return tab;
  }
  return 'crops';
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(readLocation);

  useEffect(() => {
    const onPopState = () => setRoute(readLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(path: string) {
    if (`${window.location.pathname}${window.location.search}` !== path) {
      window.history.pushState({}, '', path);
    }
    setRoute(readLocation());
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function handleStartReport(params: { parcelId: string; cropId: string; date: string }) {
    const qs = new URLSearchParams({
      id: params.parcelId,
      uprawa: params.cropId,
      data: params.date
    });
    navigate(`/raport?${qs.toString()}`);
  }

  function handleSelectMethodologyTab(tab: MethodologyTab) {
    if (tab === 'simulator') {
      navigate('/metodyka/symulator');
    } else if (tab === 'crops') {
      navigate('/metodyka');
    } else {
      navigate(`/metodyka?tab=${tab}`);
    }
  }

  const isReport = route.pathname.startsWith('/raport');
  const isMethodology = route.pathname.startsWith('/metodyka');
  const methodologyTab = parseMethodologyTab(route.pathname, route.search);

  let activeRoute: AppRouteKey = 'start';
  if (isReport) {
    activeRoute = 'report';
  } else if (isMethodology) {
    activeRoute = methodologyTab === 'apis' ? 'apis' : 'methodology';
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F5] text-[#141D19]">
      <TopHeader activeRoute={activeRoute} onNavigate={navigate} />

      <main
        className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9 ${
          isMethodology ? 'max-w-[1280px]' : 'max-w-[1160px]'
        }`}
      >
        {isReport ? (
          <ReportPage queryString={route.search} onGoHome={() => navigate('/')} />
        ) : isMethodology ? (
          <MethodologyPage
            activeTab={methodologyTab}
            onSelectTab={handleSelectMethodologyTab}
          />
        ) : (
          <StartPage onStartReport={handleStartReport} />
        )}
      </main>

      <footer className="border-t border-[#DCE2DD] bg-white mt-10 print:hidden">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#55665D]">
          <div>
            <p className="font-semibold text-[#141D19]">
              Water Buddy · Prosty doradca wody i retencji dla rolników
            </p>
            <p className="mt-0.5">
              Korzystamy wyłącznie z bezpłatnych, publicznych danych pogodowych, satelitarnych i
              geodezyjnych.
            </p>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <a
              href="/metodyka"
              onClick={(e) => {
                e.preventDefault();
                navigate('/metodyka');
              }}
              className="font-semibold text-[#1B5E4A] hover:underline"
            >
              Jak to liczymy
            </a>
            <a
              href="/metodyka?tab=apis"
              onClick={(e) => {
                e.preventDefault();
                navigate('/metodyka?tab=apis');
              }}
              className="font-semibold text-[#1B5E4A] hover:underline"
            >
              Źródła danych
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
