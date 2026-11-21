// Bezpieczny odczyt ULDK GUGiK.
// Przy przeciążeniu GUGiK przekierowuje zapytania na integracja01.gugik.gov.pl/resp/uldk.php,
// który zwraca "0" + ok. 130 MB śmieci. Taka odpowiedź nie może zostać przyjęta jako działka.

const ULDK_HOST = 'uldk.gugik.gov.pl';
const MAX_RESPONSE_BYTES = 2_000_000;
const RESULT_FIELDS = 'id,voivodeship,county,commune,region,parcel,geom_wkt';

export interface UldkParcelRecord {
  id: string;
  voivodeship: string;
  county: string;
  commune: string;
  region: string;
  parcelNumber: string;
  wkt: string;
}

export class UldkUnavailableError extends Error {}

export function buildUldkByIdUrl(id: string): string {
  return `https://${ULDK_HOST}/?request=GetParcelById&id=${encodeURIComponent(id)}&result=${RESULT_FIELDS}&srid=4326`;
}

export function buildUldkByXyUrl(lat: number, lon: number): string {
  return `https://${ULDK_HOST}/?request=GetParcelByXY&xy=${lon.toFixed(6)},${lat.toFixed(6)},4326&result=${RESULT_FIELDS}&srid=4326`;
}

async function readTextCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UldkUnavailableError('Odpowiedź ULDK jest podejrzanie duża (ograniczenie ruchu GUGiK).');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Parsuje odpowiedź ULDK. Zwraca null, gdy działki nie ma ("-1 ..."),
// rzuca UldkUnavailableError, gdy odpowiedź nie wygląda na poprawną odpowiedź ULDK.
export function parseUldkResponse(text: string): UldkParcelRecord | null {
  const lines = text.trim().split(/\r?\n/);
  const statusLine = lines[0]?.trim() ?? '';
  if (statusLine.startsWith('-1')) return null;
  if (statusLine !== '0' || !lines[1]) {
    throw new UldkUnavailableError('Nieoczekiwana odpowiedź ULDK.');
  }

  const parts = lines[1].split('|').map((p) => p.trim());
  const wkt = parts[6] ?? '';
  if (parts.length < 7 || !parts[0] || !/^(SRID=\d+;)?(MULTI)?POLYGON/i.test(wkt)) {
    throw new UldkUnavailableError('Odpowiedź ULDK nie zawiera poprawnego obrysu działki.');
  }

  return {
    id: parts[0],
    voivodeship: parts[1],
    county: parts[2],
    commune: parts[3],
    region: parts[4],
    parcelNumber: parts[5],
    wkt
  };
}

export async function fetchUldkParcel(
  url: string,
  options: { timeoutMs: number; userAgent?: string }
): Promise<UldkParcelRecord | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: options.userAgent ? { 'User-Agent': options.userAgent } : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs)
    });
  } catch {
    throw new UldkUnavailableError('Serwer GUGiK nie odpowiada.');
  }

  // Przekierowanie = ograniczenie ruchu po stronie GUGiK, nie prawdziwa odpowiedź
  if (res.status >= 300 && res.status < 400) {
    throw new UldkUnavailableError('GUGiK chwilowo ogranicza ruch (przekierowanie).');
  }
  if (!res.ok) {
    throw new UldkUnavailableError(`Serwer GUGiK zwrócił błąd ${res.status}.`);
  }

  const text = await readTextCapped(res, MAX_RESPONSE_BYTES);
  return parseUldkResponse(text);
}
