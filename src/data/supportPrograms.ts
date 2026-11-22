// Gdzie szukać wsparcia dla zaleceń. Nazwy praktyk ekoschematu "Rolnictwo węglowe i zarządzanie
// składnikami odżywczymi" pochodzą z Planu Strategicznego WPR 2023–2027; warunki i stawki
// zmieniają się co roku, dlatego każda podpowiedź odsyła do aktualnego naboru ARiMR i do ODR.

export interface RuleSupportHint {
  programPl: string;
}

const CARBON_FARMING = 'Ekoschemat „Rolnictwo węglowe i zarządzanie składnikami odżywczymi”';

export const RULE_SUPPORT_HINTS: Record<string, RuleSupportHint> = {
  R04_STOK_BEZ_OKRYWY_KBW: {
    programPl: `${CARBON_FARMING} — praktyka „Międzyplony ozime lub wsiewki śródplonowe”.`
  },
  R19_OKRYWA_ZIMOWA_ODBUDOWA: {
    programPl: `${CARBON_FARMING} — praktyka „Międzyplony ozime lub wsiewki śródplonowe”.`
  },
  R09_MULCZ_RESZTKI_POZNIWNE: {
    programPl: `${CARBON_FARMING} — praktyka „Wymieszanie słomy z glebą”.`
  },
  R08_GLEBA_LEKKA_MATERIA_ORGANICZNA: {
    programPl: `${CARBON_FARMING} — praktyki „Wymieszanie słomy z glebą” oraz wymieszanie obornika z glebą na gruntach ornych.`
  },
  R20_RETENCJA_PROCHNICA_WIELOLETNIA: {
    programPl: `${CARBON_FARMING} — praktyki „Wymieszanie słomy z glebą”, wymieszanie obornika z glebą oraz „Międzyplony ozime lub wsiewki śródplonowe”.`
  },
  R10_UPRAWA_KONSERWUJACA_BEZ_ORKI: {
    programPl: `${CARBON_FARMING} — praktyka „Uproszczone systemy uprawy”.`
  },
  R05_ROW_MELIORACYJNY_ZASTAWKA: {
    programPl:
      'Piętrzenie wody na rowie: uzgodnienie ze spółką wodną / Wodami Polskimi; dofinansowanie małej retencji bywa dostępne w wojewódzkich funduszach ochrony środowiska (WFOŚiGW).'
  },
  R17_ODPLYW_JESIEN_ZIMA_ROW: {
    programPl:
      'Piętrzenie wody na rowie: uzgodnienie ze spółką wodną / Wodami Polskimi; dofinansowanie małej retencji bywa dostępne w wojewódzkich funduszach ochrony środowiska (WFOŚiGW).'
  },
  R06_ZAGLEBIENIE_OCZKO_WODNE: {
    programPl:
      'Oczko wodne / mała retencja: sprawdź programy WFOŚiGW i wymogi Prawa wodnego (zgłoszenie lub pozwolenie).'
  },
  R07_ZADRZEWIENIA_WIATROCHRONNE: {
    programPl:
      'Zadrzewienia śródpolne bywają wspierane w naborach ARiMR i programach wojewódzkich — zapytaj w ODR o aktualne możliwości.'
  },
  R13_NAWADNIANIE_OPCJONALNE_WYCZERPANIE_RAW: {
    programPl:
      'Inwestycje w nawadnianie bywają współfinansowane z Planu Strategicznego WPR (nabory ARiMR) — wymagają pozwolenia wodnoprawnego.'
  }
};

export const SUPPORT_DISCLAIMER_PL =
  'Warunki i stawki zmieniają się co roku — sprawdź aktualny nabór ARiMR lub zapytaj w ODR.';

// Wojewódzkie ośrodki doradztwa rolniczego (klucz = nazwa województwa jak w ULDK)
export const ODR_BY_VOIVODESHIP: Record<string, string> = {
  dolnośląskie: 'Dolnośląski ODR we Wrocławiu',
  'kujawsko-pomorskie': 'Kujawsko-Pomorski ODR w Minikowie',
  lubelskie: 'Lubelski ODR w Końskowoli',
  lubuskie: 'Lubuski ODR w Kalsku',
  łódzkie: 'Łódzki ODR w Bratoszewicach',
  małopolskie: 'Małopolski ODR w Karniowicach',
  mazowieckie: 'Mazowiecki ODR w Warszawie',
  opolskie: 'Opolski ODR w Łosiowie',
  podkarpackie: 'Podkarpacki ODR w Boguchwale',
  podlaskie: 'Podlaski ODR w Szepietowie',
  pomorskie: 'Pomorski ODR w Lubaniu',
  śląskie: 'Śląski ODR w Częstochowie',
  świętokrzyskie: 'Świętokrzyski ODR w Modliszewicach',
  'warmińsko-mazurskie': 'Warmińsko-Mazurski ODR w Olsztynie',
  wielkopolskie: 'Wielkopolski ODR w Poznaniu',
  zachodniopomorskie: 'Zachodniopomorski ODR w Barzkowicach'
};

export function findOdrForVoivodeship(voivodeship: string | null | undefined): string | null {
  if (!voivodeship) return null;
  return ODR_BY_VOIVODESHIP[voivodeship.trim().toLowerCase()] ?? null;
}
