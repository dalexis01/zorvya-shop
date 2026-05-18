import { NextResponse } from "next/server";

import {
  getDeliveryBlockById,
  reorderBlockOrders,
  updateBlockRoute,
} from "@/lib/server/admin/delivery-blocks-store";
import { geocodeAddressForAdmin, getStoreCoordinates } from "@/lib/server/delivery-quote";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getAdminOrdersByIds } from "@/lib/server/admin/orders";
import { STORE_ADDRESS } from "@/helpers/delivery";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type LatLng = { latitude: number; longitude: number };

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

type GoogleLegRouteResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
  }>;
};

type LegEstimate = {
  distanceKm: number;
  durationMinutes: number;
};

function getRoutesApiKey() {
  return process.env.GOOGLE_MAPS_ROUTES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "";
}

function parseGoogleDurationToMinutes(duration: string | undefined) {
  if (!duration) return 0;
  const match = /^(\d+)s$/.exec(duration.trim());
  if (!match) return 0;

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(seconds / 60));
}

async function getLegEstimate(origin: LatLng, destination: LatLng): Promise<LegEstimate> {
  const routesApiKey = getRoutesApiKey();

  if (routesApiKey) {
    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": routesApiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: { location: { latLng: origin } },
          destination: { location: { latLng: destination } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE_OPTIMAL",
          languageCode: "es-419",
          regionCode: "sr",
          units: "METRIC",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });

      if (response.ok) {
        const payload = (await response.json()) as GoogleLegRouteResponse;
        const route = payload.routes?.[0];
        if (route?.distanceMeters && route.distanceMeters > 0) {
          return {
            distanceKm: Number((route.distanceMeters / 1000).toFixed(2)),
            durationMinutes: parseGoogleDurationToMinutes(route.duration),
          };
        }
      }
    } catch (error) {
      console.warn("[blocks/autoroute] Google leg estimate failed, falling back to OSRM.", error);
    }
  }

  const osrmRes = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "sorvya-admin-delivery/1.0" },
    }
  );
  const osrmData = (await osrmRes.json()) as OsrmRouteResponse;
  const route = osrmData.routes?.[0];

  return {
    distanceKm: Number((((route?.distance ?? 0) / 1000) || 0).toFixed(2)),
    durationMinutes: Math.max(1, Math.round((route?.duration ?? 0) / 60)),
  };
}

async function optimizeOrderSequence(
  storeCoords: LatLng,
  orders: Awaited<ReturnType<typeof getAdminOrdersByIds>>,
  coordsByOrderId: Map<string, LatLng>
) {
  const optimizedOrders: typeof orders = [];
  const remainingOrders = [...orders];
  let currentPoint = storeCoords;

  while (remainingOrders.length > 0) {
    const estimates = await Promise.all(
      remainingOrders.map(async (order) => ({
        order,
        estimate: await getLegEstimate(currentPoint, coordsByOrderId.get(order.id)!),
      }))
    );

    estimates.sort((left, right) => {
      if (left.estimate.distanceKm !== right.estimate.distanceKm) {
        return left.estimate.distanceKm - right.estimate.distanceKm;
      }
      return left.estimate.durationMinutes - right.estimate.durationMinutes;
    });

    const nextStop = estimates[0];
    optimizedOrders.push(nextStop.order);
    currentPoint = coordsByOrderId.get(nextStop.order.id)!;
    remainingOrders.splice(
      remainingOrders.findIndex((order) => order.id === nextStop.order.id),
      1
    );
  }

  return optimizedOrders;
}

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

    const blockOrderIds = block.orders.map((slot) => slot.orderId);
    const blockOrders = await getAdminOrdersByIds(blockOrderIds);

    if (blockOrders.length === 0) {
      return NextResponse.json({ success: false, error: "No se encontraron las ordenes del bloque." }, { status: 400 });
    }

    const [storeCoords, ...orderCoords] = await Promise.all([
      getStoreCoordinates(),
      ...blockOrders.map((order) => geocodeAddressForAdmin(order.customerAddress)),
    ]);

    const coordsByOrderId = new Map<string, LatLng>();
    blockOrders.forEach((order, index) => {
      const coord = orderCoords[index];
      coordsByOrderId.set(order.id, {
        latitude: coord?.latitude ?? storeCoords.latitude,
        longitude: coord?.longitude ?? storeCoords.longitude,
      });
    });

    const optimizedOrders = await optimizeOrderSequence(
      { latitude: storeCoords.latitude, longitude: storeCoords.longitude },
      blockOrders,
      coordsByOrderId
    );

    await reorderBlockOrders(id, optimizedOrders.map((order) => order.id));

    const waypoints: [number, number][] = [
      [storeCoords.latitude, storeCoords.longitude],
      ...optimizedOrders.map((order) => {
        const coords = coordsByOrderId.get(order.id)!;
        return [coords.latitude, coords.longitude] as [number, number];
      }),
      [storeCoords.latitude, storeCoords.longitude],
    ];

    const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

    const osrmRes = await fetch(osrmUrl, {
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "sorvya-admin-delivery/1.0" },
    });

    if (!osrmRes.ok) {
      return NextResponse.json({ success: false, error: "Error al calcular la ruta." }, { status: 502 });
    }

    const osrmData = (await osrmRes.json()) as OsrmRouteResponse;
    if (osrmData.code !== "Ok" || !osrmData.routes?.[0]) {
      return NextResponse.json({ success: false, error: "No se encontro una ruta valida." }, { status: 404 });
    }

    const route = osrmData.routes[0];
    const totalDistanceKm = Number(((route.distance ?? 0) / 1000).toFixed(2));
    const totalDurationMin = Math.round((route.duration ?? 0) / 60);
    const legs = route.legs ?? [];

    const legData = optimizedOrders.map((order, index) => ({
      orderId: order.id,
      distanceKm: Number(((legs[index]?.distance ?? 0) / 1000).toFixed(2)),
      durationMinutes: Math.round((legs[index]?.duration ?? 0) / 60),
    }));

    const rawCoords = route.geometry?.coordinates ?? [];
    const polyline = JSON.stringify(rawCoords.map(([lng, lat]) => [lat, lng]));

    await updateBlockRoute(id, {
      distanceKm: totalDistanceKm,
      durationMinutes: totalDurationMin,
      polyline,
      legs: legData,
    });

    const addresses = [STORE_ADDRESS, ...optimizedOrders.map((order) => order.customerAddress), STORE_ADDRESS];
    const gmapsUrl = buildGoogleMapsUrl(addresses);

    return NextResponse.json({
      success: true,
      distanceKm: totalDistanceKm,
      durationMinutes: totalDurationMin,
      legs: legData,
      gmapsUrl,
      orderedIds: optimizedOrders.map((order) => order.id),
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
