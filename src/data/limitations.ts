import limitationsJson from '../../public/data/limitations.json';

export interface LimitationSentence {
  id: string;
  kategoria:
    | 'Aktualność danych'
    | 'Dokładność i rozdzielczość'
    | 'Niepewność modelu'
    | 'Czynniki nieuwzględnione'
    | 'Ograniczenia prawne i decyzje';
  kiedy_stosowac: string;
  warunek_kod: string;
  zdanie_do_raportu: string;
  zrodlo_lub_podstawa: string;
}

export const LIMITATIONS_DATA: LimitationSentence[] = limitationsJson as LimitationSentence[];
