"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// CSS imported globally in app/globals.css

export type RouteMapStop = {
  stopNumber: number;
  label: string;
  address: string;
  coords: [number, number];
};

type RouteMapProps = {
  stops: RouteMapStop[];
  storeCoords: [number, number];
  routePath: [number, number][] | null;
};

function createStopIcon(number: number) {
  return L.divIcon({
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:#22d3ee;color:#0a0f1e;
      display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:13px;line-height:1;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      border:3px solid #fff;
    ">${number}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

function createStoreIcon() {
  return L.divIcon({
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:#fbbf24;color:#0a0f1e;
      display:flex;align-items:center;justify-content:center;
      font-size:15px;line-height:1;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      border:3px solid #fff;
    ">★</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

/** Calls invalidateSize so Leaflet recalculates after flex layout settles */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });
    return () => cancelAnimationFrame(id);
  }, [map]);
  return null;
}

/** Fits map to all points after coords are known */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], animate: false });
  }, [map, points]);
  return null;
}

const PARAMARIBO: [number, number] = [5.852, -55.2038];

export default function RouteMap({ stops, storeCoords, routePath }: RouteMapProps) {
  const markerPoints: [number, number][] = [storeCoords, ...stops.map((s) => s.coords)];
  const boundsPoints = routePath && routePath.length > 1 ? routePath : markerPoints;

  return (
    // Explicit pixel height so Leaflet always has a concrete size to measure
    <div style={{ height: "100%", width: "100%", minHeight: "260px" }} className="overflow-hidden rounded-[1.25rem]">
      <MapContainer
        center={PARAMARIBO}
        zoom={12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Fix Leaflet size after dynamic mount */}
        <MapResizer />

        {/* Fit camera to route */}
        <FitBounds points={boundsPoints} />

        {/* Real road polyline */}
        {routePath && routePath.length > 1 && (
          <Polyline
            positions={routePath}
            pathOptions={{ color: "#22d3ee", weight: 4, opacity: 0.9 }}
          />
        )}

        {/* Fallback dashed line while route loads */}
        {(!routePath || routePath.length < 2) && markerPoints.length > 1 && (
          <Polyline
            positions={markerPoints}
            pathOptions={{ color: "#475569", weight: 2, opacity: 0.6, dashArray: "6 5" }}
          />
        )}

        {/* Store */}
        <Marker position={storeCoords} icon={createStoreIcon()}>
          <Popup><strong>Almacen (origen)</strong></Popup>
        </Marker>

        {/* Stops */}
        {stops.map((stop) => (
          <Marker key={stop.stopNumber} position={stop.coords} icon={createStopIcon(stop.stopNumber)}>
            <Popup>
              <strong>Parada {stop.stopNumber}</strong><br />
              {stop.label}<br />
              <span style={{ fontSize: "0.8em", color: "#555" }}>{stop.address}</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
