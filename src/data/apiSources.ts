import apiSourcesJson from '../../public/data/api_sources.json';

export interface ApiSourceSpec {
  id: string;
  nazwa: string;
  kategoria_kowr:
    | 'Przestrzenne'
    | 'Meteorologiczne'
    | 'Satelitarne'
    | 'Glebowe'
    | 'Hydrologiczne'
    | 'Tło suszowe';
  dostawca: string;
  metoda: 'GET' | 'POST';
  url_przykladowy: string;
  body_przykladowe?: string;
  format_odpowiedzi: string;
  przykladowa_odpowiedz: string;
  status_weryfikacji:
    | 'Zweryfikowane (200 OK)'
    | 'Ograniczony dostęp bezpośredni (wymaga obejścia / WMS zastępczego)';
  pobieranie_tryb:
    | 'Na żywo w chwili zapytania'
    | 'Na żywo + cache'
    | 'Pre-agregacja / WMS na żywo';
  dane_historyczne_10_lat: string;
  rozdzielczosc: string;
  limity_i_klucz: string;
  licencja: string;
  uwagi_dla_operatora: string;
}

export const API_SOURCES_DATA: ApiSourceSpec[] = apiSourcesJson as ApiSourceSpec[];
