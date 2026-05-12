"use client";

import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Point = {
  lat: number;
  lng: number;
};

type Zone = {
  id: string;
  name: string;
  center: Point;
  radiusMiles: number;
};

type Props = {
  warehouse: Point;
  freeZones: Zone[];
  userLocation: Point | null;
};

export default function DeliveryMap({
  warehouse,
  freeZones,
  userLocation,
}: Props) {
  const center: [number, number] = [5.852, -55.2038];

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-[1.25rem]">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <CircleMarker
          center={[warehouse.lat, warehouse.lng]}
          radius={10}
          pathOptions={{
            color: "#FFC107",
            fillColor: "#FFC107",
            fillOpacity: 1,
          }}
        >
          <Popup>Almacén principal</Popup>
        </CircleMarker>

        {freeZones.map((zone) => (
          <Circle
            key={zone.id}
            center={[zone.center.lat, zone.center.lng]}
            radius={zone.radiusMiles * 1609.34}
            pathOptions={{
              color: "#00E0D1",
              fillColor: "#00E0D1",
              fillOpacity: 0.18,
            }}
          >
            <Popup>{zone.name} - Delivery gratis con compra mínima</Popup>
          </Circle>
        ))}

        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={9}
            pathOptions={{
              color: "#7A2CFF",
              fillColor: "#7A2CFF",
              fillOpacity: 1,
            }}
          >
            <Popup>Tu ubicación</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}