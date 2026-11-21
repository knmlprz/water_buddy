import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ParcelGeometryInfo } from '../types/analysis';

type BaseLayerMode = 'osm' | 'ortho';

interface ParcelMapProps {
  parcel?: ParcelGeometryInfo | null;
  interactive?: boolean;
  onSelectPoint?: (lat: number, lon: number) => void;
  heightClass?: string;
  initialBaseLayer?: BaseLayerMode;
  ndviValue?: number | null;
  ndviDate?: string | null;
  showNdviToggle?: boolean;
  hasDepression?: boolean;
  ditchDistanceM?: number;
}

function getNdviColor(ndvi: number | null | undefined): {
  fill: string;
  stroke: string;
  label: string;
} {
  if (ndvi === null || ndvi === undefined) {
    return { fill: '#64748B', stroke: '#334155', label: 'Brak danych satelitarnych' };
  }
  if (ndvi < 0.2) {
    return { fill: '#B45309', stroke: '#78350F', label: 'Gleba odkryta / silny stres (< 0,20)' };
  }
  if (ndvi < 0.4) {
    return { fill: '#CA8A04', stroke: '#854D0E', label: 'Słaba pokrywa / wczesny stres (0,20–0,40)' };
  }
  if (ndvi < 0.6) {
    return { fill: '#65A30D', stroke: '#3F6212', label: 'Umiarkowana zieleń (0,40–0,60)' };
  }
  return { fill: '#15803D', stroke: '#14532D', label: 'Gęsty, zdrowy łan (≥ 0,60)' };
}

export function ParcelMap({
  parcel,
  interactive = false,
  onSelectPoint,
  heightClass = 'h-[320px]',
  initialBaseLayer = 'osm',
  ndviValue = null,
  ndviDate = null,
  showNdviToggle = false,
  hasDepression = false,
  ditchDistanceM
}: ParcelMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const osmLayerRef = useRef<L.TileLayer | null>(null);
  const orthoLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectPoint);

  const [baseLayer, setBaseLayer] = useState<BaseLayerMode>(initialBaseLayer);
  const [ndviOverlayOn, setNdviOverlayOn] = useState(false);
  const clickMarkerRef = useRef<L.CircleMarker | null>(null);

  onSelectRef.current = onSelectPoint;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [52.1, 19.3],
      zoom: 6,
      zoomControl: true,
      scrollWheelZoom: interactive
    });

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    });

    const ortho = L.tileLayer.wms(
      'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution',
      {
        layers: 'Raster',
        format: 'image/jpeg',
        transparent: false,
        version: '1.1.1',
        attribution: 'Ortofotomapa: GUGiK'
      }
    );

    if (initialBaseLayer === 'ortho') {
      ortho.addTo(map);
    } else {
      osm.addTo(map);
    }

    const overlayGroup = L.layerGroup().addTo(map);

    if (interactive) {
      map.on('click', (ev: L.LeafletMouseEvent) => {
        if (clickMarkerRef.current) {
          map.removeLayer(clickMarkerRef.current);
        }
        clickMarkerRef.current = L.circleMarker(ev.latlng, {
          radius: 7,
          color: '#1B5E4A',
          weight: 2.5,
          fillColor: '#FFFFFF',
          fillOpacity: 0.9
        }).addTo(map);
        onSelectRef.current?.(ev.latlng.lat, ev.latlng.lng);
      });
    }

    mapRef.current = map;
    osmLayerRef.current = osm;
    orthoLayerRef.current = ortho;
    overlayGroupRef.current = overlayGroup;

    // Ensure Leaflet measures container properly inside tabs/details
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [interactive, initialBaseLayer]);

  // Switch OSM / GUGiK Ortofotomapa base layers
  useEffect(() => {
    const map = mapRef.current;
    const osm = osmLayerRef.current;
    const ortho = orthoLayerRef.current;
    if (!map || !osm || !ortho) return;

    if (baseLayer === 'ortho') {
      if (map.hasLayer(osm)) map.removeLayer(osm);
      if (!map.hasLayer(ortho)) ortho.addTo(map);
    } else {
      if (map.hasLayer(ortho)) map.removeLayer(ortho);
      if (!map.hasLayer(osm)) osm.addTo(map);
    }
  }, [baseLayer]);

  // Render parcel polygon, NDVI shading, and terrain/hydro annotations
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (clickMarkerRef.current && parcel) {
      map.removeLayer(clickMarkerRef.current);
      clickMarkerRef.current = null;
    }

    if (!parcel) return;

    const ndviStyle = getNdviColor(ndviValue);
    const useNdviStyle = showNdviToggle && ndviOverlayOn && ndviValue !== null;

    if (parcel.polygonLatLngs.length >= 3) {
      const poly = L.polygon(parcel.polygonLatLngs, {
        color: useNdviStyle ? ndviStyle.stroke : '#1B5E4A',
        weight: 2.5,
        fillColor: useNdviStyle ? ndviStyle.fill : '#1B5E4A',
        fillOpacity: useNdviStyle ? 0.58 : 0.22
      });
      poly.addTo(group);

      if (useNdviStyle) {
        poly.bindTooltip(`NDVI: ${ndviValue.toFixed(2)} (${ndviDate ?? 'brak daty'})`, {
          sticky: true
        });
      }

      map.invalidateSize();
      const bounds = poly.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
      }
    } else {
      const marker = L.circleMarker(parcel.centroid, {
        radius: 7,
        color: '#1B5E4A',
        fillColor: '#1B5E4A',
        fillOpacity: 0.75
      });
      marker.addTo(group);
      map.setView(parcel.centroid, 15);
    }

    // Optional terrain depression marker
    if (hasDepression) {
      L.circleMarker(parcel.centroid, {
        radius: 8,
        color: '#0369A1',
        weight: 2,
        fillColor: '#38BDF8',
        fillOpacity: 0.5
      })
        .bindTooltip('Lokalne zagłębienie terenu (> 0,5 m wg NMT)', { direction: 'top' })
        .addTo(group);
    }

    // Optional ditch buffer ring (when ditch detected within 500 m)
    if (ditchDistanceM !== undefined && ditchDistanceM <= 500) {
      L.circle(parcel.centroid, {
        radius: ditchDistanceM,
        color: '#0284C7',
        weight: 1.5,
        dashArray: '5 5',
        fillOpacity: 0.04
      })
        .bindTooltip(`Strefa wykrytego rowu BDOT10k (ok. ${ditchDistanceM} m)`, { sticky: true })
        .addTo(group);
    }
  }, [parcel, ndviOverlayOn, ndviValue, ndviDate, showNdviToggle, hasDepression, ditchDistanceM]);

  const ndviMeta = getNdviColor(ndviValue);

  return (
    <div className="border border-[#DCE2DD] rounded-xl overflow-hidden bg-white">
      <div className="px-3 py-2 bg-[#FAFBFA] border-b border-[#E6EBE7] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setBaseLayer('osm')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              baseLayer === 'osm'
                ? 'bg-[#1B5E4A] text-white'
                : 'text-[#4B5A52] hover:bg-[#EDF1EE]'
            }`}
          >
            Mapa OSM
          </button>
          <button
            type="button"
            onClick={() => setBaseLayer('ortho')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              baseLayer === 'ortho'
                ? 'bg-[#1B5E4A] text-white'
                : 'text-[#4B5A52] hover:bg-[#EDF1EE]'
            }`}
          >
            Ortofotomapa GUGiK
          </button>
          {showNdviToggle && (
            <button
              type="button"
              disabled={ndviValue === null}
              onClick={() => setNdviOverlayOn((v) => !v)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                ndviValue === null
                  ? 'text-[#94A19A] cursor-not-allowed'
                  : ndviOverlayOn
                    ? 'bg-[#15803D] text-white cursor-pointer'
                    : 'text-[#4B5A52] hover:bg-[#EDF1EE] cursor-pointer'
              }`}
            >
              {ndviOverlayOn ? 'Warstwa NDVI: WŁ' : 'Pokaż NDVI'}
            </button>
          )}
        </div>
        <span className="text-[11px] text-[#617068]">
          {interactive
            ? 'Przybliż mapę i kliknij w swoje pole, aby pobrać granice działki'
            : parcel
              ? `${parcel.centroid[0].toFixed(4)}°N, ${parcel.centroid[1].toFixed(4)}°E`
              : ''}
        </span>
      </div>

      <div
        ref={containerRef}
        className={`w-full ${heightClass} z-0 ${interactive ? 'cursor-crosshair' : ''}`}
      />

      {showNdviToggle && ndviOverlayOn && ndviValue !== null && (
        <div className="px-3 py-2 border-t border-[#E6EBE7] bg-[#FAFBFA] flex flex-wrap items-center justify-between gap-2 text-xs text-[#3F4E46]">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-xs border"
              style={{ backgroundColor: ndviMeta.fill, borderColor: ndviMeta.stroke }}
            />
            <span className="font-semibold tabular-nums">NDVI = {ndviValue.toFixed(2)}</span>
            <span>· {ndviMeta.label}</span>
          </div>
          <span className="text-[11px] text-[#617068] tabular-nums">
            Scena Sentinel-2: {ndviDate ?? 'brak'}
          </span>
        </div>
      )}
    </div>
  );
}
