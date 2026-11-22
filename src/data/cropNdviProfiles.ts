// Orientacyjne NDVI dobrze rozwiniętego, zdrowego łanu (Sentinel-2 L2A, warunki polskie) dla
// kolejnych miesięcy (indeks 0 = styczeń). null = w tym miesiącu łan zwykle nie stoi na polu
// (przed siewem, po zbiorze, spoczynek zimowy) — NDVI nie mówi wtedy nic o stanie uprawy.
// Wartości opracowane przez zespół na podstawie typowych krzywych fenologicznych upraw;
// służą do interpretacji ("typowa / poniżej typowej dla tej uprawy w tej fazie"), nie do diagnozy.

export const CROP_NDVI_PROFILES: Record<string, (number | null)[]> = {
  //               sty   lut   mar   kwi   maj   cze   lip   sie   wrz   paź   lis   gru
  pszenica_ozima: [null, null, 0.35, 0.55, 0.75, 0.7, 0.4, null, null, 0.25, 0.3, null],
  zyto_ozime: [null, null, 0.35, 0.55, 0.75, 0.65, 0.4, null, null, 0.25, 0.3, null],
  jeczmien_jary: [null, null, null, 0.25, 0.55, 0.75, 0.45, null, null, null, null, null],
  rzepak_ozimy: [null, null, 0.45, 0.7, 0.65, 0.6, null, null, 0.35, 0.55, 0.5, null],
  kukurydza: [null, null, null, null, 0.2, 0.45, 0.75, 0.8, 0.65, null, null, null],
  ziemniak: [null, null, null, null, 0.2, 0.6, 0.75, 0.55, null, null, null, null],
  burak_cukrowy: [null, null, null, null, 0.25, 0.6, 0.8, 0.8, 0.75, 0.6, null, null],
  // Pokosy obniżają NDVI kilka razy w sezonie — interpretacja z mniejszą pewnością
  lucerna: [null, null, null, 0.55, 0.7, 0.65, 0.65, 0.65, 0.6, null, null, null]
};

export type NdviCropStatus = 'typowa' | 'ponizej' | 'wyraznie_ponizej' | 'nie_oceniamy';

export interface NdviCropAssessment {
  status: NdviCropStatus;
  expectedNdvi: number | null;
  ratio: number | null;
  textPl: string;
}

const MONTHS_PL = [
  'styczniu', 'lutym', 'marcu', 'kwietniu', 'maju', 'czerwcu',
  'lipcu', 'sierpniu', 'wrześniu', 'październiku', 'listopadzie', 'grudniu'
];

export function assessNdviForCrop(params: {
  cropId: string;
  cropNamePl: string;
  sceneDate: string | null;
  ndvi: number | null;
  inHarvestWindow: boolean;
}): NdviCropAssessment {
  const { cropId, cropNamePl, sceneDate, ndvi, inHarvestWindow } = params;
  if (ndvi === null || !sceneDate) {
    return { status: 'nie_oceniamy', expectedNdvi: null, ratio: null, textPl: 'Brak zdjęcia satelitarnego — kondycji łanu nie oceniamy.' };
  }
  const month = Number(sceneDate.slice(5, 7)) - 1;
  const expected = CROP_NDVI_PROFILES[cropId]?.[month] ?? null;
  if (inHarvestWindow) {
    return { status: 'nie_oceniamy', expectedNdvi: expected, ratio: null, textPl: `Okres zbioru (${cropNamePl}) — spadek NDVI jest naturalny, nie oceniamy go jako stresu.` };
  }
  if (expected === null) {
    return { status: 'nie_oceniamy', expectedNdvi: null, ratio: null, textPl: `W ${MONTHS_PL[month]} ${cropNamePl.toLowerCase()} zwykle nie stoi na polu — NDVI opisuje okrywę gleby, nie kondycję uprawy.` };
  }
  const ratio = Number((ndvi / expected).toFixed(2));
  const status: NdviCropStatus = ratio >= 0.85 ? 'typowa' : ratio >= 0.65 ? 'ponizej' : 'wyraznie_ponizej';
  const textPl =
    status === 'typowa'
      ? `Zieleń typowa dla tej uprawy w ${MONTHS_PL[month]} (NDVI ${ndvi.toFixed(2)}, typowo ok. ${expected.toFixed(2)}).`
      : status === 'ponizej'
        ? `Zieleń nieco słabsza niż typowo dla tej uprawy w ${MONTHS_PL[month]} (NDVI ${ndvi.toFixed(2)}, typowo ok. ${expected.toFixed(2)}).`
        : `Zieleń wyraźnie słabsza niż typowo dla tej uprawy w ${MONTHS_PL[month]} (NDVI ${ndvi.toFixed(2)}, typowo ok. ${expected.toFixed(2)}) — możliwy stres wodny lub inne przyczyny; warto obejrzeć pole.`;
  return { status, expectedNdvi: expected, ratio, textPl };
}
