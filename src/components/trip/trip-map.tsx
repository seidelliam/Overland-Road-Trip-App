'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl, { type LngLatLike, type Map as MapboxMap } from 'mapbox-gl';
import { useTripStore } from '@/store/trip-store';
import { useTheme } from '@/lib/use-theme';
import { MAPBOX_TOKEN, reverseGeocode } from '@/lib/mapbox';
import {
  CATEGORY_META,
  type Route,
  type Stop,
  type AISuggestion,
} from '@/lib/types';
import { Loader2, Crosshair, Pin, X } from 'lucide-react';

mapboxgl.accessToken = MAPBOX_TOKEN;

import { useShallow } from '@/store/trip-store';

const mapStyleFor = (theme: string) => {
  switch (theme) {
    case 'light':
      return 'mapbox://styles/mapbox/light-v11';
    case 'outdoors':
      return 'mapbox://styles/mapbox/outdoors-v12';
    default:
      return 'mapbox://styles/mapbox/dark-v11';
  }
};

const selectRoutes = (s: any): Route[] => s.routes;
const selectStops = (s: any): Stop[] => s.stops;
const selectActiveRouteId = (s: any) => s.activeRouteId;
const selectIsAddingStop = (s: any) => s.isAddingStop;
const selectAddStop = (s: any) => s.addStop;
const selectSetAddingStop = (s: any) => s.setAddingStop;
const selectAiSuggestions = (s: any): AISuggestion[] => s.aiSuggestions;
const selectHoveredSuggestionId = (s: any) => s.hoveredSuggestionId;

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
  const suggestionMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  // The theme the current basemap was built/swapped to — lets us skip a
  // redundant setStyle on first mount without sniffing the style URL.
  const appliedThemeRef = useRef<string | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const routesFromStore = useTripStore(useShallow(selectRoutes));
  const stopsFromStore = useTripStore(useShallow(selectStops));
  const activeRouteId = useTripStore(selectActiveRouteId);
  const isAddingStop = useTripStore(selectIsAddingStop);
  const addStop = useTripStore(selectAddStop);
  const setAddingStop = useTripStore(selectSetAddingStop);
  const aiSuggestions = useTripStore(useShallow(selectAiSuggestions));
  const hoveredSuggestionId = useTripStore(selectHoveredSuggestionId);
  const theme = useTheme((s) => s.theme);

  const routes = routesOverride ?? routesFromStore;
  const stops = stopsOverride ?? stopsFromStore;

  // Initialize map once. Read the theme imperatively so the map isn't torn down
  // and rebuilt on theme changes — those are handled by setStyle below.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    appliedThemeRef.current = useTheme.getState().theme;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyleFor(appliedThemeRef.current),
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

  // Swap the basemap when the app theme changes. setStyle drops style-owned
  // layers/sources, so we flip styleReady off; the 'style.load' handler set up
  // above flips it back on, which re-runs the route/marker draw effects. DOM
  // markers survive setStyle untouched.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Already on this theme's basemap (e.g. first mount) — nothing to do.
    if (appliedThemeRef.current === theme) return;
    appliedThemeRef.current = theme;
    setStyleReady(false);
    map.setStyle(mapStyleFor(theme));
  }, [theme]);

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

  // Highlight national parks & forests, but only as you zoom in toward the
  // route — opacity ramps from 0 (zoomed out, whole-US view) to a gentle green
  // tint by ~z12, so it reads as helpful context without painting the map.
  // Fills come from the basemap's own `composite` vector source (Mapbox Streets
  // v8), which every theme here is built on, and sit beneath labels + routes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    if (!map.getSource('composite')) return; // non-Streets style — skip

    // Insert below the first text/symbol layer so park fills never cover labels.
    const firstSymbol = (map.getStyle()?.layers ?? []).find(
      (l) => l.type === 'symbol',
    )?.id;

    const addFill = (
      id: string,
      sourceLayer: string,
      filter: any,
      maxOpacity: number,
      color: string,
    ) => {
      if (map.getLayer(id)) return;
      try {
        map.addLayer(
          {
            id,
            type: 'fill',
            source: 'composite',
            'source-layer': sourceLayer,
            filter,
            paint: {
              'fill-color': color,
              'fill-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7,
                0,
                9,
                maxOpacity * 0.5,
                12,
                maxOpacity,
              ],
            },
          },
          firstSymbol,
        );
      } catch {
        // Style without this source-layer/class — ignore.
      }
    };

    // National & state parks (landuse_overlay carries the `national_park` class).
    addFill(
      'mp-national-parks',
      'landuse_overlay',
      ['==', ['get', 'class'], 'national_park'],
      0.28,
      '#3f9b5c',
    );
    // Forests / woodland (covers national forests, which aren't a distinct class).
    addFill(
      'mp-forests',
      'landuse',
      ['in', ['get', 'class'], ['literal', ['wood', 'park']]],
      0.2,
      '#2f7d4f',
    );
  }, [styleReady, theme]);

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
        // Outer element is positioned by Mapbox (it owns its `transform`), so we
        // never touch its transform. All visuals + the hover scale live on an
        // inner element — otherwise scaling the outer wipes Mapbox's translate
        // and the marker snaps to the map's top-left until the next repaint.
        const el = document.createElement('div');
        el.className = 'mp-marker';
        el.style.cssText = 'width:32px;height:32px;';
        const inner = document.createElement('div');
        inner.className = 'mp-marker-inner';
        inner.style.cssText = `
          width: 100%;
          height: 100%;
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
        inner.textContent = String(idx + 1);
        el.appendChild(inner);
        el.addEventListener('mouseenter', () => {
          inner.style.transform = 'scale(1.15)';
        });
        el.addEventListener('mouseleave', () => {
          inner.style.transform = 'scale(1)';
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
          `<div style="min-width:180px"><div class="mp-popup-photo"></div><div style="font-size:11px;color:var(--color-fg-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">${meta.emoji} ${meta.label}</div><div style="font-size:14px;font-weight:600;line-height:1.3">${escapeHtml(stop.name)}</div>${stop.address ? `<div style="font-size:12px;color:var(--color-fg-muted);margin-top:4px">${escapeHtml(stop.address)}</div>` : ''}</div>`,
        );
        attachPopupPhoto(popup, stop.name, stop.lat, stop.lng);
        marker.setPopup(popup);

        markersRef.current[stop.id] = marker;
      } else {
        marker.setLngLat([stop.lng, stop.lat]);
        const inner = marker.getElement().firstElementChild as HTMLElement;
        inner.style.background = color;
        inner.style.boxShadow = `0 0 0 1.5px ${color}, 0 8px 16px -4px rgba(0,0,0,0.7)`;
      }

      // Update label to position number
      (marker.getElement().firstElementChild as HTMLElement).textContent =
        String(idx + 1);
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

  // Render Claude's not-yet-added suggestions as lightweight "ghost" waypoints:
  // small, dashed, translucent pins distinct from real stops. Only on the
  // primary interactive map (not the read-only compare/override maps).
  useEffect(() => {
    const map = mapRef.current;
    const showSuggestions = !!map && styleReady && interactive && !routesOverride;

    // Drop everything if suggestions are hidden or cleared.
    const keep = showSuggestions
      ? new Set(aiSuggestions.map((s) => s.id))
      : new Set<string>();
    for (const id of Object.keys(suggestionMarkersRef.current)) {
      if (!keep.has(id)) {
        suggestionMarkersRef.current[id].remove();
        delete suggestionMarkersRef.current[id];
      }
    }
    if (!showSuggestions) return;

    for (const s of aiSuggestions) {
      if (suggestionMarkersRef.current[s.id]) {
        suggestionMarkersRef.current[s.id].setLngLat([s.lng, s.lat]);
        continue;
      }
      const meta = CATEGORY_META[s.category];
      // Outer = Mapbox-positioned wrapper (don't touch its transform); inner
      // carries the visuals + hover/active scale. See the stop-marker note above.
      const el = document.createElement('div');
      el.className = 'mp-suggestion-marker';
      el.style.cssText = 'width:26px;height:26px;';
      const inner = document.createElement('div');
      inner.className = 'mp-suggestion-marker-inner';
      inner.style.cssText = `
        width: 100%;
        height: 100%;
        border-radius: 999px;
        background: var(--color-surface);
        color: ${meta.color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        border: 1.5px dashed ${meta.color};
        box-shadow: 0 4px 10px -4px rgba(0,0,0,0.6);
        opacity: 0.85;
        cursor: pointer;
        transition: transform 0.15s ease, opacity 0.15s ease;
      `;
      inner.textContent = meta.emoji;
      el.appendChild(inner);

      el.addEventListener('mouseenter', () =>
        useTripStore.getState().setHoveredSuggestion(s.id),
      );
      el.addEventListener('mouseleave', () =>
        useTripStore.getState().setHoveredSuggestion(null),
      );
      el.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const activeId = useTripStore.getState().activeRouteId;
        if (!activeId) return;
        useTripStore.getState().dismissSuggestion(s.id);
        await useTripStore.getState().addStop({
          routeId: activeId,
          name: s.name,
          lng: s.lng,
          lat: s.lat,
          address: s.description,
          category: s.category,
          estimated_cost: s.estimated_cost ?? null,
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .addTo(map);

      const costLine =
        s.estimated_cost != null
          ? `<div style="font-size:11px;color:var(--color-fg);margin-top:4px;font-weight:600">≈ $${Math.round(s.estimated_cost).toLocaleString()}</div>`
          : '';
      const popup = new mapboxgl.Popup({
        offset: 16,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(
        `<div style="min-width:180px"><div class="mp-popup-photo"></div><div style="font-size:11px;color:var(--color-fg-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">${meta.emoji} Claude suggestion</div><div style="font-size:14px;font-weight:600;line-height:1.3">${escapeHtml(s.name)}</div><div style="font-size:12px;color:var(--color-fg-muted);margin-top:4px">${escapeHtml(s.description)}</div>${costLine}<div style="font-size:11px;color:var(--color-accent);margin-top:6px">Click pin to add</div></div>`,
      );
      attachPopupPhoto(popup, s.name, s.lat, s.lng);
      marker.setPopup(popup);
      suggestionMarkersRef.current[s.id] = marker;
    }
  }, [aiSuggestions, styleReady, interactive, routesOverride]);

  // Sync the hovered suggestion (set from here or the AI panel) to its marker:
  // emphasize it and pop its preview open, so hovering either stays in step.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, marker] of Object.entries(suggestionMarkersRef.current)) {
      const inner = marker.getElement().firstElementChild as HTMLElement;
      const popup = marker.getPopup();
      const active = id === hoveredSuggestionId;
      inner.style.transform = active ? 'scale(1.25)' : 'scale(1)';
      inner.style.opacity = active ? '1' : '0.85';
      if (popup) {
        if (active && !popup.isOpen()) marker.togglePopup();
        else if (!active && popup.isOpen()) marker.togglePopup();
      }
    }
  }, [hoveredSuggestionId, aiSuggestions, styleReady]);

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
      // Scale padding to the map size so fitBounds never overflows a short
      // (e.g. 45vh mobile) canvas, which throws "Map cannot fit within canvas".
      const canvas = map.getCanvas();
      const padX = Math.min(80, Math.max(16, canvas.clientWidth / 6));
      const padY = Math.min(80, Math.max(16, canvas.clientHeight / 6));
      map.fitBounds(bounds, {
        padding: { top: padY, bottom: padY, left: padX, right: padX },
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
      {/* Drop-a-pin control, overlaid on the map as a small round button. */}
      {interactive && (
        <button
          type="button"
          onClick={() => setAddingStop(!isAddingStop)}
          aria-label={isAddingStop ? 'Cancel dropping a pin' : 'Drop a pin on the map'}
          title={isAddingStop ? 'Cancel' : 'Drop a pin on the map'}
          className={`absolute bottom-4 left-4 z-10 grid h-11 w-11 place-items-center rounded-full shadow-lg transition-colors ${
            isAddingStop
              ? 'bg-accent text-bg'
              : 'glass text-fg hover:text-accent'
          }`}
        >
          {isAddingStop ? (
            <X className="h-5 w-5" />
          ) : (
            <Pin className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}

// Lazily load a representative photo into a popup the first time it opens, so we
// don't fetch images for markers the user never hovers. The popup HTML reserves
// an empty `.mp-popup-photo` slot that we fill once the image resolves. Reuses
// the same /api/place-info endpoint as the stop detail card (Google Places when
// configured, else Wikipedia).
function attachPopupPhoto(
  popup: mapboxgl.Popup,
  name: string,
  lat: number,
  lng: number,
) {
  let loaded = false;
  popup.on('open', () => {
    if (loaded) return;
    loaded = true;
    const params = new URLSearchParams({ q: name, lat: String(lat), lng: String(lng) });
    fetch(`/api/place-info?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const url = data?.photos?.[0]?.url as string | undefined;
        if (!url) return;
        const slot = popup
          .getElement()
          ?.querySelector('.mp-popup-photo') as HTMLElement | null;
        if (!slot) return;
        slot.innerHTML = `<img src="${escapeHtml(url)}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:6px;margin-bottom:6px;display:block" />`;
      })
      .catch(() => {});
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
