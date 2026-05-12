import { NextRequest, NextResponse } from "next/server";

import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

type OsrmRouteGeometry = {
  routes?: Array<{
    geometry?: {
      type?: string;
      coordinates?: Array<[number, number]>;
    };
    distance?: number;
    duration?: number;
  }>;
  code?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminRequestUser();

  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { waypoints?: unknown }).waypoints)
  ) {
    return NextResponse.json({ error: "waypoints array required" }, { status: 400 });
  }

  const rawWaypoints = (body as { waypoints: unknown[] }).waypoints;

  const waypoints = rawWaypoints.filter(
    (wp): wp is [number, number] =>
      Array.isArray(wp) &&
      wp.length === 2 &&
      typeof wp[0] === "number" &&
      typeof wp[1] === "number"
  );

  if (waypoints.length < 2) {
    return NextResponse.json({ error: "At least 2 waypoints required" }, { status: 400 });
  }

  // OSRM expects longitude,latitude order
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "sorvya-admin-delivery/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "OSRM request failed" }, { status: 502 });
    }

    const data = (await response.json()) as OsrmRouteGeometry;

    if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) {
      return NextResponse.json({ error: "No route found" }, { status: 404 });
    }

    const rawCoords = data.routes[0].geometry.coordinates;

    // Convert from OSRM [lng, lat] GeoJSON order to Leaflet [lat, lng] order
    const path: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);
    const distanceKm = Number(((data.routes[0].distance ?? 0) / 1000).toFixed(1));
    const durationMinutes = Math.round((data.routes[0].duration ?? 0) / 60);

    return NextResponse.json({ success: true, path, distanceKm, durationMinutes });
  } catch {
    return NextResponse.json({ error: "Route calculation failed" }, { status: 502 });
  }
}
