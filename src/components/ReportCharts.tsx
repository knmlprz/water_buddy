import type {
  CumulativeKbwPoint,
  NdviSeasonPoint,
  YearlyCriticalKbwBar
} from '../types/analysis';
import type { CropParameter } from '../data/crops';

interface KbwCumulativeChartProps {
  points: CumulativeKbwPoint[];
  crop: CropParameter;
  analysisDate: string;
}

export function KbwCumulativeChart({
  points,
  crop,
  analysisDate
}: KbwCumulativeChartProps) {
  if (points.length < 2) {
    return (
      <div className="p-4 border border-[#E2E7E3] rounded-lg bg-[#FAFBFA] text-sm text-[#5A6961]">
        Brak wystarczającej serii sezonowej KBW do wyrysowania wykresu (analiza przed 21 marca lub
        brak danych z Open-Meteo).
      </div>
    );
  }

  const W = 680;
  const H = 250;
  const pad = { top: 20, right: 20, bottom: 34, left: 50 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const allVals: number[] = [0];
  points.forEach((p) => {
    if (p.thisYear !== null) allVals.push(p.thisYear);
    if (p.median10y !== null) allVals.push(p.median10y);
    if (p.min10y !== null) allVals.push(p.min10y);
    if (p.max10y !== null) allVals.push(p.max10y);
  });

  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const margin = Math.max(20, (rawMax - rawMin) * 0.12);
  const yMin = Math.floor((rawMin - margin) / 20) * 20;
  const yMax = Math.ceil((rawMax + margin) / 20) * 20;
  const ySpan = Math.max(yMax - yMin, 40);

  const xScale = (idx: number) => pad.left + (idx / (points.length - 1)) * plotW;
  const yScale = (val: number) => pad.top + ((yMax - val) / ySpan) * plotH;

  // Build shaded band for min10y .. max10y
  const bandTop: string[] = [];
  const bandBottom: string[] = [];
  points.forEach((p, idx) => {
    if (p.max10y !== null && p.min10y !== null) {
      bandTop.push(`${xScale(idx).toFixed(1)},${yScale(p.max10y).toFixed(1)}`);
      bandBottom.unshift(`${xScale(idx).toFixed(1)},${yScale(p.min10y).toFixed(1)}`);
    }
  });
  const bandPath =
    bandTop.length > 1 ? `M ${bandTop.join(' L ')} L ${bandBottom.join(' L ')} Z` : '';

  const buildLine = (getter: (p: CumulativeKbwPoint) => number | null) => {
    const segs: string[] = [];
    points.forEach((p, idx) => {
      const v = getter(p);
      if (v !== null) {
        segs.push(`${segs.length === 0 ? 'M' : 'L'} ${xScale(idx).toFixed(1)},${yScale(v).toFixed(1)}`);
      }
    });
    return segs.join(' ');
  };

  const medianLine = buildLine((p) => p.median10y);
  const thisYearLine = buildLine((p) => p.thisYear);

  // Critical window shaded vertical band
  const critIndices = points
    .map((p, idx) => (p.inCriticalWindow ? idx : -1))
    .filter((i) => i >= 0);
  const critX1 = critIndices.length ? xScale(critIndices[0]) : null;
  const critX2 = critIndices.length ? xScale(critIndices[critIndices.length - 1]) : null;

  const yTicks = [yMax, Math.round((yMax + yMin) / 2), 0, yMin].filter(
    (v, i, arr) => v >= yMin && v <= yMax && arr.indexOf(v) === i
  );
  const xLabelStep = Math.max(1, Math.floor(points.length / 6));

  const lastPt = points[points.length - 1];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-[#141D19]">
          Wykres 1. Skumulowany KBW od 21.03 do {analysisDate} na tle 10 lat
        </h4>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#55665D]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-[#1B5E4A]" /> Bieżący sezon
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 border-t border-dashed border-[#64748B]" /> Mediana 10 lat
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 bg-[#CBD5E1]/50" /> Rozstęp min–max
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 bg-[#FEF3C7]" /> Okno krytyczne ({crop.nazwa_pl})
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Wykres skumulowanego KBW od 21 marca na tle 10 lat"
        className="w-full h-auto bg-white border border-[#E2E7E3] rounded-lg"
      >
        {/* Critical window highlight */}
        {critX1 !== null && critX2 !== null && (
          <rect
            x={critX1}
            y={pad.top}
            width={Math.max(critX2 - critX1, 6)}
            height={plotH}
            fill="#FEF3C7"
            opacity={0.55}
          />
        )}

        {/* Horizontal gridlines + Y labels */}
        {yTicks.map((val) => {
          const y = yScale(val);
          return (
            <g key={val}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke={val === 0 ? '#94A3B8' : '#E6EBE7'}
                strokeWidth={val === 0 ? 1.2 : 1}
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-[#617068] text-[10px] font-mono"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* 10y min-max ribbon */}
        {bandPath && <path d={bandPath} fill="#CBD5E1" opacity={0.38} />}

        {/* 10y median */}
        {medianLine && (
          <path
            d={medianLine}
            fill="none"
            stroke="#475569"
            strokeWidth={1.6}
            strokeDasharray="4 4"
          />
        )}

        {/* Current year line */}
        {thisYearLine && (
          <path d={thisYearLine} fill="none" stroke="#1B5E4A" strokeWidth={2.5} />
        )}

        {/* Last point dot + value */}
        {lastPt?.thisYear !== null && (
          <g>
            <circle
              cx={xScale(points.length - 1)}
              cy={yScale(lastPt.thisYear)}
              r={4}
              fill="#1B5E4A"
            />
            <text
              x={xScale(points.length - 1) - 6}
              y={yScale(lastPt.thisYear) - 8}
              textAnchor="end"
              className="fill-[#141D19] text-[10px] font-mono font-semibold"
            >
              {lastPt.thisYear} mm
            </text>
          </g>
        )}

        {/* X axis dates */}
        {points.map((p, idx) => {
          if (idx % xLabelStep !== 0 && idx !== points.length - 1) return null;
          return (
            <text
              key={p.mmdd}
              x={xScale(idx)}
              y={H - 10}
              textAnchor="middle"
              className="fill-[#617068] text-[10px] font-mono"
            >
              {p.label}
            </text>
          );
        })}

        {/* Y axis unit */}
        <text x={8} y={14} className="fill-[#617068] text-[10px] font-mono">
          mm
        </text>
      </svg>
    </div>
  );
}

interface KbwTenYearBarsChartProps {
  bars: YearlyCriticalKbwBar[];
  thresholdMm: number;
  referenceLabel?: string;
  crop: CropParameter;
}

export function KbwTenYearBarsChart({
  bars,
  thresholdMm,
  referenceLabel,
  crop
}: KbwTenYearBarsChartProps) {
  if (bars.length === 0) {
    return (
      <div className="p-4 border border-[#E2E7E3] rounded-lg bg-[#FAFBFA] text-sm text-[#5A6961]">
        Brak danych wieloletnich dla okna krytycznego tej uprawy.
      </div>
    );
  }

  const W = 680;
  const H = 230;
  const pad = { top: 24, right: 20, bottom: 34, left: 50 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const vals = bars.map((b) => b.kbwMm);
  const yMin = Math.min(-40, thresholdMm - 30, ...vals) - 15;
  const yMax = Math.max(20, ...vals) + 15;
  const ySpan = Math.max(yMax - yMin, 60);

  const yScale = (v: number) => pad.top + ((yMax - v) / ySpan) * plotH;
  const zeroY = yScale(0);
  const threshY = yScale(thresholdMm);

  const slotW = plotW / bars.length;
  const barW = Math.min(34, Math.max(14, slotW * 0.62));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-[#141D19]">
          Wykres 2. KBW ({crop.nazwa_pl}, {referenceLabel ?? 'okno krytyczne uprawy'}) — ostatnie 10 lat
        </h4>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#55665D]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-[#C2410C] rounded-xs" /> Rok suchy (≤ {thresholdMm} mm)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-[#6E8B7D] rounded-xs" /> W normie
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Słupki KBW w oknie krytycznym uprawy z ostatnich 10 lat"
        className="w-full h-auto bg-white border border-[#E2E7E3] rounded-lg"
      >
        {/* Zero line */}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={zeroY}
          y2={zeroY}
          stroke="#94A3B8"
          strokeWidth={1.1}
        />
        <text x={pad.left - 8} y={zeroY + 4} textAnchor="end" className="fill-[#617068] text-[10px] font-mono">
          0
        </text>

        {/* Drought threshold line */}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={threshY}
          y2={threshY}
          stroke="#B91C1C"
          strokeWidth={1.3}
          strokeDasharray="5 4"
        />
        <text
          x={W - pad.right - 4}
          y={threshY - 5}
          textAnchor="end"
          className="fill-[#B91C1C] text-[10px] font-mono font-semibold"
        >
          Próg suszy ({thresholdMm} mm)
        </text>
        <text x={pad.left - 8} y={threshY + 4} textAnchor="end" className="fill-[#B91C1C] text-[10px] font-mono">
          {thresholdMm}
        </text>

        {/* Bars */}
        {bars.map((b, idx) => {
          const cx = pad.left + idx * slotW + slotW / 2;
          const x = cx - barW / 2;
          const valY = yScale(b.kbwMm);
          const topY = Math.min(zeroY, valY);
          const height = Math.max(Math.abs(valY - zeroY), 2);
          const fill = b.dry ? '#C2410C' : '#6E8B7D';

          return (
            <g key={b.year}>
              <rect
                x={x}
                y={topY}
                width={barW}
                height={height}
                rx={2}
                fill={fill}
                stroke={b.isCurrent ? '#141D19' : 'none'}
                strokeWidth={b.isCurrent ? 1.8 : 0}
              />
              <text
                x={cx}
                y={b.kbwMm < 0 ? topY + height + 12 : topY - 4}
                textAnchor="middle"
                className="fill-[#37463F] text-[9px] font-mono"
              >
                {b.kbwMm}
              </text>
              <text
                x={cx}
                y={H - 10}
                textAnchor="middle"
                className={`text-[10px] font-mono ${
                  b.isCurrent ? 'fill-[#141D19] font-bold' : 'fill-[#617068]'
                }`}
              >
                {b.year}
              </text>
            </g>
          );
        })}

        <text x={8} y={14} className="fill-[#617068] text-[10px] font-mono">
          mm
        </text>
      </svg>
    </div>
  );
}

interface NdviSeasonChartProps {
  points: NdviSeasonPoint[];
  ndviMedianRef: number | null;
  crop: CropParameter;
}

export function NdviSeasonChart({
  points,
  ndviMedianRef,
  crop
}: NdviSeasonChartProps) {
  if (points.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-[#141D19]">
          Wykres 3. Zieleń (NDVI) i uwodnienie roślin (NDMI) w sezonie
        </h4>
        <div className="p-4 border border-[#E2E7E3] rounded-lg bg-[#FAFBFA] text-sm text-[#5A6961]">
          Brak bezchmurnych scen Sentinel-2 (≥ 70% czystych pikseli wg maski SCL) w ostatnich 90
          dniach przed datą analizy. Zgodnie z zasadami KOWR nie interpolujemy brakujących
          obserwacji satelitarnych.
        </div>
      </div>
    );
  }

  const W = 680;
  const H = 220;
  const pad = { top: 20, right: 24, bottom: 34, left: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const yMin = -0.3;
  const yMax = 1.0;
  const ySpan = yMax - yMin;

  const xScale = (idx: number) =>
    points.length === 1 ? pad.left + plotW / 2 : pad.left + (idx / (points.length - 1)) * plotW;
  const yScale = (val: number) => pad.top + ((yMax - val) / ySpan) * plotH;

  const ndviLine = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)},${yScale(p.ndvi).toFixed(1)}`)
    .join(' ');

  const ndmiPoints = points
    .map((p, i) => (p.ndmi !== null ? { i, val: p.ndmi } : null))
    .filter((v): v is { i: number; val: number } => v !== null);

  const ndmiLine = ndmiPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(p.i).toFixed(1)},${yScale(p.val).toFixed(1)}`)
    .join(' ');

  const yTicks = [0.8, 0.6, 0.4, 0.2, 0.0, -0.2];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-[#141D19]">
          Wykres 3. Zieleń (NDVI) i uwodnienie (NDMI) z Sentinel-2 L2A
        </h4>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#55665D]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-[#15803D]" /> NDVI
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-[#2563EB]" /> NDMI
          </span>
          {ndviMedianRef !== null && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 border-t border-dashed border-[#64748B]" /> Mediana
              z lat poprz. ({ndviMedianRef.toFixed(2)})
            </span>
          )}
          <span className="text-[#78716C]">
            Okno zbioru: {crop.okno_zbior_start_mmdd} – {crop.okno_zbior_koniec_mmdd}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Wykres NDVI i NDMI z obserwacji Sentinel-2"
        className="w-full h-auto bg-white border border-[#E2E7E3] rounded-lg"
      >
        {yTicks.map((val) => {
          const y = yScale(val);
          return (
            <g key={val}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke={val === 0 ? '#94A3B8' : '#E6EBE7'}
                strokeWidth={val === 0 ? 1.1 : 1}
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-[#617068] text-[10px] font-mono"
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Multi-year NDVI median reference */}
        {ndviMedianRef !== null && (
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={yScale(ndviMedianRef)}
            y2={yScale(ndviMedianRef)}
            stroke="#64748B"
            strokeWidth={1.3}
            strokeDasharray="4 4"
          />
        )}

        {/* NDMI line */}
        {ndmiPoints.length > 1 && (
          <path d={ndmiLine} fill="none" stroke="#2563EB" strokeWidth={2} />
        )}
        {ndmiPoints.map((p) => (
          <circle
            key={`ndmi-${p.i}`}
            cx={xScale(p.i)}
            cy={yScale(p.val)}
            r={3.5}
            fill="#2563EB"
          />
        ))}

        {/* NDVI line */}
        {points.length > 1 && (
          <path d={ndviLine} fill="none" stroke="#15803D" strokeWidth={2.5} />
        )}
        {points.map((p, idx) => (
          <g key={p.date}>
            <circle cx={xScale(idx)} cy={yScale(p.ndvi)} r={4.5} fill="#15803D" />
            <text
              x={xScale(idx)}
              y={yScale(p.ndvi) - 8}
              textAnchor="middle"
              className="fill-[#14532D] text-[10px] font-mono font-semibold"
            >
              {p.ndvi.toFixed(2)}
            </text>
            <text
              x={xScale(idx)}
              y={H - 10}
              textAnchor="middle"
              className="fill-[#617068] text-[10px] font-mono"
            >
              {p.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
