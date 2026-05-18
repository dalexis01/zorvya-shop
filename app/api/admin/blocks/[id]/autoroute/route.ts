import { NextResponse } from "next/server";

import {
  getDeliveryBlockById,
  updateBlockRoute,
} from "@/lib/server/admin/delivery-blocks-store";
import { geocodeAddressForAdmin, getStoreCoordinates } from "@/lib/server/delivery-quote";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getAdminOrders } from "@/lib/server/admin/orders";
import { STORE_ADDRESS } from "@/helpers/delivery";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: Array<[number, number]>;
    };
    legs?: Array<{
      distance?: number;
      duration?: number;
    }>;
  }>;
};

export async function POST(_req: Request, ctx: RouteContext) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;

  try {
    const block = await getDeliveryBlockById(id);
    if (!block) return NextResponse.json({ success: false, error: "Bloque no encontrado." }, { status: 404 });

    if (!block.orders || block.orders.length === 0) {
      return NextResponse.json({ success: false, error: "El bloque no tiene ordenes." }, { status: 400 });
    }

    // Get orders to access addresses
    const { orders: allOrders } = await getAdminOrders({ status: "all", deliveryType: "delivery" });
    const blockOrderIds = block.orders.map((s) => s.orderId);
    const blockOrders = blockOrderIds
      .map((oid) => allOrders.find((o) => o.id === oid))
      .filter(Boolean);

    if (blockOrders.length === 0) {
      return NextResponse.json({ success: false, error: "No se encontraron las ordenes del bloque." }, { status: 400 });
    }

    // Geocode all addresses in parallel
    const [storeCoords, ...orderCoords] = await Promise.all([
      getStoreCoordinates(),
      ...blockOrders.map((o) => geocodeAddressForAdmin(o!.customerAddress)),
    ]);

    // Build waypoint list: store → orders
    const waypoints: [number, number][] = [[storeCoords.latitude, storeCoords.longitude]];
    for (const coord of orderCoords) {
      if (coord) {
        waypoints.push([coord.latitude, coord.longitude]);
      } else {
        // Fallback to store coordinates if geocoding failed
        waypoints.push([storeCoords.latitude, storeCoords.longitude]);
      }
    }
    // Return to store
    waypoints.push([storeCoords.latitude, storeCoords.longitude]);

    if (waypoints.length < 2) {
      return NextResponse.json({ success: false, error: "No se pudieron obtener coordenadas para calcular la ruta." }, { status: 400 });
    }

    // Call OSRM routing API
    const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

    const osrmRes = await fetch(osrmUrl, {
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "sorvya-admin-delivery/1.0" },
    });

    if (!osrmRes.ok) {
      return NextResponse.json({ success: false, error: "Error al calcular la ruta con OSRM." }, { status: 502 });
    }

    const osrmData = (await osrmRes.json()) as OsrmRouteResponse;

    if (osrmData.code !== "Ok" || !osrmData.routes?.[0]) {
      return NextResponse.json({ success: false, error: "No se encontró ruta." }, { status: 404 });
    }

    const route = osrmData.routes[0];
    const totalDistanceKm = Number(((route.distance ?? 0) / 1000).toFixed(2));
    const totalDurationMin = Math.round((route.duration ?? 0) / 60);

    // Build leg data
    const legs = route.legs ?? [];
    const legData = blockOrders.map((order, i) => ({
      orderId: order!.id,
      distanceKm: Number(((legs[i]?.distance ?? 0) / 1000).toFixed(2)),
      durationMinutes: Math.round((legs[i]?.duration ?? 0) / 60),
    }));

    // Encode polyline as JSON string of [lat,lng] points
    const rawCoords = route.geometry?.coordinates ?? [];
    const polyline = JSON.stringify(rawCoords.map(([lng, lat]) => [lat, lng]));

    // Save route to block
    await updateBlockRoute(id, {
      distanceKm: totalDistanceKm,
      durationMinutes: totalDurationMin,
      polyline,
      legs: legData,
    });

    // Build Google Maps link (addresses, no API key needed)
    const addresses = [STORE_ADDRESS, ...blockOrders.map((o) => o!.customerAddress), STORE_ADDRESS];
    const gmapsUrl = buildGoogleMapsUrl(addresses);

    return NextResponse.json({
      success: true,
      distanceKm: totalDistanceKm,
      durationMinutes: totalDurationMin,
      legs: legData,
      gmapsUrl,
    });
  } catch (err) {
    console.error("[blocks/autoroute] POST error:", err);
    return NextResponse.json({ success: false, error: "Error al calcular la ruta." }, { status: 500 });
  }
}

function buildGoogleMapsUrl(addresses: string[]): string {
  if (addresses.length < 2) return "";
  const origin = encodeURIComponent(addresses[0]);
  const destination = encodeURIComponent(addresses[addresses.length - 1]);
  const waypoints = addresses.slice(1, -1).map(encodeURIComponent).join("|");
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  return waypoints ? `${base}&waypoints=${waypoints}` : base;
}
