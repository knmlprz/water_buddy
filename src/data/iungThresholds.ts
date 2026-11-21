// Progi klimatycznego bilansu wodnego (KBW) oznaczające wystąpienie suszy rolniczej
// wg Rozporządzenia MRiRW z 11.04.2019 — tabela IUNG-PIB SMSR (https://susza.iung.pulawy.pl/progi/).
// Wartość = próg KBW [mm] dla okresu sześciodekadowego; null = uprawa nie oceniana w tym okresie
// lub na tej kategorii gleby. Susza, gdy KBW okresu <= próg.

export type IungSoilCategory = 'I' | 'II' | 'III' | 'IV';

export interface IungPeriod {
  nr: number;
  startMmDd: string;
  endMmDd: string;
  label: string;
}

export const IUNG_PERIODS: IungPeriod[] = [
  { nr: 1, startMmDd: '03-21', endMmDd: '05-20', label: '21.III–20.V' },
  { nr: 2, startMmDd: '04-01', endMmDd: '05-31', label: '1.IV–31.V' },
  { nr: 3, startMmDd: '04-11', endMmDd: '06-10', label: '11.IV–10.VI' },
  { nr: 4, startMmDd: '04-21', endMmDd: '06-20', label: '21.IV–20.VI' },
  { nr: 5, startMmDd: '05-01', endMmDd: '06-30', label: '1.V–30.VI' },
  { nr: 6, startMmDd: '05-11', endMmDd: '07-10', label: '11.V–10.VII' },
  { nr: 7, startMmDd: '05-21', endMmDd: '07-20', label: '21.V–20.VII' },
  { nr: 8, startMmDd: '06-01', endMmDd: '07-31', label: '1.VI–31.VII' },
  { nr: 9, startMmDd: '06-11', endMmDd: '08-10', label: '11.VI–10.VIII' },
  { nr: 10, startMmDd: '06-21', endMmDd: '08-20', label: '21.VI–20.VIII' },
  { nr: 11, startMmDd: '07-01', endMmDd: '08-31', label: '1.VII–31.VIII' },
  { nr: 12, startMmDd: '07-11', endMmDd: '09-10', label: '11.VII–10.IX' },
  { nr: 13, startMmDd: '07-21', endMmDd: '09-20', label: '21.VII–20.IX' },
  { nr: 14, startMmDd: '08-01', endMmDd: '09-30', label: '1.VIII–30.IX' }
];

export const IUNG_KBW_THRESHOLDS: Record<string, Record<IungSoilCategory, (number | null)[]>> = {
  'Zboża ozime': {
    I: [-129, -132, -137, -145, -154, -165, -180, -199, -220, null, null, null, null, null],
    II: [-150, -153, -158, -166, -175, -186, -201, -220, -241, null, null, null, null, null],
    III: [-188, -191, -196, -204, -213, -224, -239, -258, -279, null, null, null, null, null],
    IV: [-215, -218, -223, -231, -240, -251, -266, -285, -306, null, null, null, null, null],
  },
  'Zboża jare': {
    I: [-125, -127, -130, -135, -142, -153, -169, -186, -207, null, null, null, null, null],
    II: [-144, -146, -149, -154, -161, -172, -188, -205, -226, null, null, null, null, null],
    III: [-174, -176, -179, -184, -191, -202, -218, -235, -256, null, null, null, null, null],
    IV: [-194, -196, -199, -204, -211, -222, -238, -255, -276, null, null, null, null, null],
  },
  'Kukurydza na ziarno': {
    I: [null, null, null, -168, -161, -156, -153, -152, -153, -154, -156, -158, -161, -164],
    II: [null, null, null, -200, -193, -188, -185, -184, -185, -186, -188, -190, -193, -196],
    III: [null, null, null, -236, -229, -224, -221, -220, -221, -222, -224, -226, -229, -232],
    IV: [null, null, null, -271, -264, -259, -256, -255, -256, -257, -259, -261, -264, -267],
  },
  'Kukurydza na kiszonkę': {
    I: [null, null, null, -168, -161, -156, -153, -152, -152, -152, -153, -155, -157, -160],
    II: [null, null, null, -200, -193, -188, -185, -184, -184, -184, -185, -187, -189, -192],
    III: [null, null, null, -236, -229, -224, -221, -220, -220, -220, -221, -223, -225, -228],
    IV: [null, null, null, -271, -264, -259, -256, -255, -255, -255, -256, -258, -260, -263],
  },
  'Rzepak i rzepik': {
    I: [-207, -187, -170, -155, -142, -132, null, null, null, null, null, null, -138, -138],
    II: [-232, -211, -193, -177, -165, -155, null, null, null, null, null, null, -158, -158],
    III: [-275, -254, -236, -220, -208, -198, null, null, null, null, null, null, -205, -205],
    IV: [-297, -276, -258, -242, -230, -220, null, null, null, null, null, null, -230, -230],
  },
  'Ziemniak': {
    I: [null, null, -238, -232, -226, -219, -210, -200, -189, -178, -168, -157, -147, null],
    II: [null, null, -257, -251, -245, -238, -229, -219, -208, -197, -187, -176, -166, null],
    III: [null, null, -286, -280, -274, -267, -258, -248, -237, -226, -216, -205, -195, null],
    IV: [null, null, -306, -300, -294, -287, -278, -268, -257, -246, -236, -225, -215, null],
  },
  'Burak cukrowy': {
    I: [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    II: [-250, -248, -245, -241, -237, -232, -226, -220, -212, -202, -192, -182, -169, -155],
    III: [-277, -275, -272, -268, -264, -259, -253, -247, -239, -229, -219, -209, -196, -182],
    IV: [-296, -294, -291, -287, -283, -278, -272, -266, -258, -248, -238, -228, -215, -201],
  },
  'Rośliny strączkowe': {
    I: [null, null, null, -161, -161, -163, -165, -166, -167, -168, -170, -172, -174, -176],
    II: [null, null, null, -182, -182, -184, -186, -187, -188, -189, -191, -193, -195, -197],
    III: [null, null, null, -213, -213, -215, -217, -218, -219, -220, -222, -224, -226, -228],
    IV: [null, null, null, -234, -234, -236, -238, -239, -240, -241, -243, -245, -247, -249],
  },
};

// Uprawy aplikacji -> gatunek w rozporządzeniu. Lucerny rozporządzenie nie obejmuje.
export const CROP_TO_IUNG_SPECIES: Record<string, string> = {
  pszenica_ozima: 'Zboża ozime',
  zyto_ozime: 'Zboża ozime',
  jeczmien_jary: 'Zboża jare',
  rzepak_ozimy: 'Rzepak i rzepik',
  kukurydza: 'Kukurydza na ziarno',
  ziemniak: 'Ziemniak',
  burak_cukrowy: 'Burak cukrowy'
};

export function iungCategoryFromLabel(kategoriaIung: string): IungSoilCategory | null {
  const match = /^(IV|III|II|I)\b/.exec(kategoriaIung.trim());
  return match ? (match[1] as IungSoilCategory) : null;
}

export function getIungThreshold(
  cropId: string,
  category: IungSoilCategory | null,
  periodNr: number
): number | null {
  const species = CROP_TO_IUNG_SPECIES[cropId];
  if (!species || !category) return null;
  return IUNG_KBW_THRESHOLDS[species]?.[category]?.[periodNr - 1] ?? null;
}
