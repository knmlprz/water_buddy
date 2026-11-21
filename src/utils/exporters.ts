import type { ApiSourceSpec } from '../data/apiSources';

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function arrayToCsv<T extends object>(rows: T[], includeBom = true): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]) as (keyof T)[];
  const headerLine = headers.map((h) => escapeCsvCell(String(h))).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvCell(row[h])).join(',')
  );
  const csvBody = [headerLine, ...dataLines].join('\r\n');
  return includeBom ? `\uFEFF${csvBody}` : csvBody;
}

export function generateReadmeSourcesMarkdown(sources: ApiSourceSpec[]): string {
  const header = [
    '## Źródła danych, tryb pobierania i licencje (HackNation 2026 · KOWR)',
    '',
    'Wszystkie źródła poniżej są bezpłatne, legalne i zostały zweryfikowane pod kątem działających zapytań HTTP/OGC.',
    '',
    '| Kategoria KOWR | Źródło | Dostawca | Tryb pobierania | Dane 10 lat (na dzień X) | Limity i klucz | Licencja i atrybucja |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ];

  const rows = sources.map((s) => {
    const clean = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return `| ${clean(s.kategoria_kowr)} | **${clean(s.nazwa)}** | ${clean(s.dostawca)} | ${clean(s.pobieranie_tryb)} | ${clean(s.dane_historyczne_10_lat)} | ${clean(s.limity_i_klucz)} | ${clean(s.licencja)} |`;
  });

  const footer = [
    '',
    '### Zweryfikowane działające przykłady zapytań (gotowe dla backendu)',
    '',
    ...sources.flatMap((s) => [
      `#### ${s.nazwa} (${s.kategoria_kowr})`,
      `- **Status testu ręcznego:** ${s.status_weryfikacji}`,
      `- **Zapytanie (${s.metoda}):** \`${s.url_przykladowy}\``,
      ...(s.body_przykladowe ? [`- **Body JSON:** \`${s.body_przykladowe}\``] : []),
      `- **Przykładowa odpowiedź:** \`${s.przykladowa_odpowiedz}\``,
      `- **Uwaga operacyjna:** ${s.uwagi_dla_operatora}`,
      ''
    ])
  ];

  return [...header, ...rows, ...footer].join('\n');
}

export function triggerBrowserDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
