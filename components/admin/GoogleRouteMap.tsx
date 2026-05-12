"use client";

import { useEffect, useRef, useState } from "react";

export type GoogleRouteMapStop = {
  stopNumber: number;
  name: string;
  address: string;
};

type Props = {
  stops: GoogleRouteMapStop[];
  storeAddress: string;
  apiKey: string;
};

type MapState = "loading" | "ready" | "error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;

declare global {
  interface Window {
    __gmAdminCb?: () => void;
    gm_authFailure?: () => void;
    __gmAuthFailed?: boolean;
  }
}

// ── module-level script state ──────────────────────────────────────────────
type ScriptState = "idle" | "loading" | "ready" | "failed";
let state: ScriptState = "idle";
let failReason = "";
const resolvers: Array<() => void> = [];
const rejecters: Array<(e: Error) => void> = [];

function settle(ok: boolean, reason = "") {
  state = ok ? "ready" : "failed";
  failReason = reason;
  if (ok) resolvers.forEach((r) => r());
  else rejecters.forEach((r) => r(new Error(reason)));
  resolvers.length = 0;
  rejecters.length = 0;
}

function loadMapsScript(apiKey: string): Promise<void> {
  if (state === "ready") return Promise.resolve();
  if (state === "failed") return Promise.reject(new Error(failReason));

  return new Promise<void>((res, rej) => {
    resolvers.push(res);
    rejecters.push(rej);

    if (state === "loading") return; // already injected
    state = "loading";

    // Official Google Maps auth failure hook
    window.gm_authFailure = () => {
      settle(
        false,
        "API key error: habilita 'Maps JavaScript API' en Google Cloud Console y verifica que la clave no tenga restricciones de HTTP referrer que bloqueen localhost."
      );
    };

    // Official async callback
    window.__gmAdminCb = () => settle(true);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__gmAdminCb&loading=async&language=es&region=SR`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      settle(false, "No se pudo descargar el script de Google Maps. Verifica la conexion a internet.");
    document.head.appendChild(script);
  });
}
// ──────────────────────────────────────────────────────────────────────────

const PARAMARIBO: G = { lat: 5.852, lng: -55.2038 };

export default function GoogleRouteMap({ stops, storeAddress, apiKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<G>(null);
  const markersRef = useRef<G[]>([]);
  const rendererRef = useRef<G>(null);

  const [mapState, setMapState] = useState<MapState>("loading");
  const [statusMsg, setStatusMsg] = useState("Cargando Google Maps...");

  // Key that changes when stop order changes → triggers re-route
  const routeKey = stops.map((s) => s.address).join("|");

  // ── initial map creation ────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) {
      setMapState("error");
      setStatusMsg("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no configurado");
      return;
    }

    let cancelled = false;

    setMapState("loading");
    setStatusMsg("Cargando Google Maps...");

    loadMapsScript(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const gmaps: G = (window as G).google.maps;

        const map = new gmaps.Map(containerRef.current, {
          zoom: 12,
          center: PARAMARIBO,
          mapTypeId: "roadmap",
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;

        const renderer = new gmaps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#1a73e8",
            strokeWeight: 5,
            strokeOpacity: 0.88,
          },
        });
        renderer.setMap(map);
        rendererRef.current = renderer;

        if (!cancelled) {
          setMapState("ready");
          setStatusMsg("");
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setMapState("error");
          setStatusMsg(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // ── route calculation — re-runs when stops change ──────────────────────
  useEffect(() => {
    if (mapState !== "ready" || !mapRef.current || !rendererRef.current) return;

    const gmaps: G = (window as G).google.maps;
    const map: G = mapRef.current;
    const renderer: G = rendererRef.current;

    // Clear old custom markers
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    if (stops.length === 0) return;

    setStatusMsg("Calculando ruta...");

    const origin = storeAddress;
    const destination = stops[stops.length - 1].address;
    const waypoints = stops.slice(0, -1).map((s) => ({
      location: s.address,
      stopover: true,
    }));

    new gmaps.DirectionsService().route(
      {
        origin,
        destination,
        waypoints,
        optimizeWaypoints: false,
        travelMode: gmaps.TravelMode.DRIVING,
      },
      (result: G, status: string) => {
        if (status !== "OK") {
          // Route failed but map is still usable — place individual markers
          setStatusMsg(`Ruta no calculada (${status}). Mostrando paradas.`);
          placeStoreMarker(gmaps, map, storeAddress, origin);
          stops.forEach((s) =>
            placeStopMarker(gmaps, map, s, null)
          );
          return;
        }

        renderer.setDirections(result);
        setStatusMsg("");

        // Store marker at route origin
        placeStoreMarker(gmaps, map, storeAddress, result.routes[0].legs[0].start_location);

        // Numbered stop markers at each leg end
        result.routes[0].legs.forEach((leg: G, i: number) => {
          const stop = stops[i];
          if (stop) placeStopMarker(gmaps, map, stop, leg.end_location);
        });
      }
    );

    function placeStoreMarker(gmaps: G, map: G, title: string, position: G) {
      const m = new gmaps.Marker({
        position,
        map,
        title,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: "#fbbf24",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2.5,
        },
        label: { text: "★", color: "#0a0f1e", fontSize: "13px", fontWeight: "bold" },
        zIndex: 200,
      });
      markersRef.current.push(m);
    }

    function placeStopMarker(gmaps: G, map: G, stop: GoogleRouteMapStop, position: G | null) {
      if (!position) return;
      const m = new gmaps.Marker({
        position,
        map,
        title: `Parada ${stop.stopNumber} – ${stop.name}`,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#22d3ee",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2.5,
        },
        label: {
          text: String(stop.stopNumber),
          color: "#0a0f1e",
          fontSize: "12px",
          fontWeight: "bold",
        },
        zIndex: 100 + stop.stopNumber,
      });

      const infoWindow = new gmaps.InfoWindow({
        content: `<div style="font-family:sans-serif;font-size:13px;min-width:170px;padding:2px 0">
          <strong>Parada ${stop.stopNumber}</strong><br/>
          ${stop.name}<br/>
          <span style="color:#666;font-size:11px">${stop.address}</span>
        </div>`,
      });
      m.addListener("click", () => infoWindow.open(map, m));
      markersRef.current.push(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapState, routeKey, storeAddress]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.25rem]">
      <div ref={containerRef} className="h-full w-full" />

      {/* Loading spinner overlay */}
      {mapState === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[1.25rem] bg-[#050816]/90">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400" />
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{statusMsg}</p>
        </div>
      )}

      {/* Error overlay */}
      {mapState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[1.25rem] bg-[#050816] p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
            <svg className="h-6 w-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-300">Google Maps no disponible</p>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">{statusMsg}</p>
          </div>
          <a
            href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-500 hover:text-white"
          >
            Habilitar Maps JavaScript API →
          </a>
        </div>
      )}

      {/* Inline status during route calc */}
      {mapState === "ready" && statusMsg && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-[#050816]/90 px-4 py-1.5 text-xs text-slate-300 backdrop-blur-sm">
          {statusMsg}
        </div>
      )}
    </div>
  );
}
