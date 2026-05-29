'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl, { type LngLatLike, type Map as MapboxMap } from 'mapbox-gl';
import { useTripStore } from '@/store/trip-store';
import { MAPBOX_TOKEN, reverseGeocode } from '@/lib/mapbox';
import { CATEGORY_META, type Route, type Stop } from '@/lib/types';
import { Loader2, Crosshair } from 'lucide-react';

mapboxgl.accessToken = MAPBOX_TOKEN;

import { useShallow } from '@/store/trip-store';

const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

const selectRoutes = (s: any): Route[] => s.routes;
const selectStops = (s: any): Stop[] => s.stops;
const selectActiveRouteId = (s: any) => s.activeRouteId;
const selectIsAddingStop = (s: any) => s.isAddingStop;
const selectAddStop = (s: any) => s.addStop;
const selectSetAddingStop = (s: any) => s.setAddingStop;

export function TripMap({
  routesOverride,
  stopsOverride,
  highlightRouteId,
  interactive = true,
  className,
}: {
  routesOverride?: Route[];
  stopsOverride?: Stop[];
  highlightRouteId?: string;
  interactive?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const [styleReady, setStyleReady] = useState(false);

  const routesFromStore = useTripStore(useShallow(selectRoutes));
  const stopsFromStore = useTripStore(useShallow(selectStops));
  const activeRouteId = useTripStore(selectActiveRouteId);
  const isAddingStop = useTripStore(selectIsAddingStop);
  const addStop = useTripStore(selectAddStop);
  const setAddingStop = useTripStore(selectSetAddingStop);

  const routes = routesOverride ?? routesFromStore;
  const stops = stopsOverride ?? stopsFromStore;

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-98.5795, 39.8283], // Center of US
      zoom: 3.5,
      interactive,
      attributionControl: false,
      pitchWithRotate: false,
      doubleClickZoom: interactive,
      dragRotate: false,
    });
    mapRef.current = map;

    if (interactive) {
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        'top-right',
      );
    }

    map.on('load', () => setStyleReady(true));
    map.on('style.load', () => setStyleReady(true));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  // Cursor for "click to add" mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = isAddingStop ? 'crosshair' : '';
  }, [isAddingStop]);

  // Handle clicks for adding stops.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactive) return;

    const onClick = async (e: mapboxgl.MapMouseEvent) => {
      const adding = useTripStore.getState().isAddingStop;
      const activeId = useTripStore.getState().activeRouteId;
      if (!adding || !activeId) return;
      setAddingStop(false);
      const { lng, lat } = e.lngLat;
      const result = await reverseGeocode(lng, lat);
      await addStop({
        routeId: activeId,
        name: result?.name ?? 'New stop',
        lng,
        lat,
        address: result?.fullAddress ?? null,
      });
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [interactive, addStop, setAddingStop]);

  // Draw route lines.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    // Remove any existing route layers/sources we own.
    const style = map.getStyle();
    const existing = (style?.layers ?? [])
      .filter((l) => l.id.startsWith('route-line-'))
      .map((l) => l.id);
    existing.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    (style?.layers ?? [])
      .filter((l) => l.id.startsWith('route-casing-'))
      .map((l) => l.id)
      .forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
    Object.keys(style?.sources ?? {})
      .filter((id) => id.startsWith('route-'))
      .forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });

    // Add new layers.
    for (const route of routes) {
      if (!route.geometry) continue;
      const sourceId = `route-${route.id}`;
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        },
      });

      const isHighlighted = highlightRouteId
        ? route.id === highlightRouteId
        : route.id === activeRouteId;

      map.addLayer({
        id: `route-casing-${route.id}`,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#000',
          'line-opacity': isHighlighted ? 0.4 : 0.2,
          'line-width': isHighlighted ? 8 : 6,
        },
      });

      map.addLayer({
        id: `route-line-${route.id}`,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': route.color,
          'line-opacity': isHighlighted ? 1 : 0.35,
          'line-width': isHighlighted ? 4 : 3,
        },
      });
    }
  }, [routes, activeRouteId, highlightRouteId, styleReady]);

  // Sync markers to stops.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const visibleStops = highlightRouteId
      ? stops.filter((s) => s.route_id === highlightRouteId)
      : routesOverride
        ? stops
        : stops.filter((s) => s.route_id === activeRouteId);

    // Remove markers not in visibleStops
    const visibleIds = new Set(visibleStops.map((s) => s.id));
    for (const id of Object.keys(markersRef.current)) {
      if (!visibleIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }

    visibleStops.forEach((stop, idx) => {
      const route = routes.find((r) => r.id === stop.route_id);
      const color = route?.color ?? '#10b981';
      const meta = CATEGORY_META[stop.category];

      let marker = markersRef.current[stop.id];
      if (!marker) {
        const el = document.createElement('div');
        el.className = 'mp-marker';
        el.style.cssText = `
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: ${color};
          color: #060809;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          font-family: var(--font-geist-sans);
          border: 2px solid #060809;
          box-shadow: 0 0 0 1.5px ${color}, 0 8px 16px -4px rgba(0,0,0,0.7);
          cursor: pointer;
          transition: transform 0.15s ease;
        `;
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.15)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });
        marker = new mapboxgl.Marker({ element: el, draggable: interactive })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);

        if (interactive) {
          marker.on('dragend', () => {
            const ll = marker.getLngLat();
            useTripStore
              .getState()
              .updateStop(stop.id, { lng: ll.lng, lat: ll.lat });
          });
        }

        const popup = new mapboxgl.Popup({
          offset: 18,
          closeButton: true,
          closeOnClick: false,
        }).setHTML(
          `<div style="min-width:180px"><div style="font-size:11px;color:var(--color-fg-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">${meta.emoji} ${meta.label}</div><div style="font-size:14px;font-weight:600;line-height:1.3">${escapeHtml(stop.name)}</div>${stop.address ? `<div style="font-size:12px;color:var(--color-fg-muted);margin-top:4px">${escapeHtml(stop.address)}</div>` : ''}</div>`,
        );
        marker.setPopup(popup);

        markersRef.current[stop.id] = marker;
      } else {
        marker.setLngLat([stop.lng, stop.lat]);
        const el = marker.getElement();
        el.style.background = color;
        el.style.boxShadow = `0 0 0 1.5px ${color}, 0 8px 16px -4px rgba(0,0,0,0.7)`;
      }

      // Update label to position number
      marker.getElement().textContent = String(idx + 1);
    });
  }, [
    stops,
    routes,
    activeRouteId,
    highlightRouteId,
    routesOverride,
    interactive,
    styleReady,
  ]);

  // Fit bounds to visible stops/routes when they change significantly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const focusStops = highlightRouteId
      ? stops.filter((s) => s.route_id === highlightRouteId)
      : routesOverride
        ? stops
        : stops.filter((s) => s.route_id === activeRouteId);
    if (focusStops.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    focusStops.forEach((s) => bounds.extend([s.lng, s.lat] as LngLatLike));

    // Include route geometry too so the whole drawn line is visible.
    const focusRoutes = highlightRouteId
      ? routes.filter((r) => r.id === highlightRouteId)
      : routesOverride
        ? routes
        : routes.filter((r) => r.id === activeRouteId);
    focusRoutes.forEach((r) => {
      r.geometry?.coordinates.forEach((c) =>
        bounds.extend(c as LngLatLike),
      );
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        maxZoom: 11,
        duration: 800,
      });
    }
    // Only fit when active route / set of route geometries changes — not on every store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRouteId, highlightRouteId, styleReady]);

  return (
    <div className={className ?? 'h-full w-full relative'}>
      <div ref={containerRef} className="h-full w-full" />
      {!styleReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/40 pointer-events-none">
          <Loader2 className="h-6 w-6 animate-spin text-fg-muted" />
        </div>
      )}
      {interactive && isAddingStop && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="glass rounded-full px-4 py-2 text-sm font-medium text-fg flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-accent animate-pulse-dot" />
            Click the map to drop a stop
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
