import { NextRequest, NextResponse } from "next/server";

import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

type GoogleGeocodeResult = {
  status?: string;
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const apiKey =
    process.env.GOOGLE_MAPS_GEOCODING_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    "";

  if (!apiKey) return null;

  const query = address.toLowerCase().includes("suriname")
    ? address
    : `${address}, Suriname`;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=sr&language=es&key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as GoogleGeocodeResult;

    if (data.status !== "OK" || !data.results?.[0]) return null;

    const loc = data.results[0].geometry?.location;

    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") return null;

    return [loc.lat, loc.lng];
  } catch {
    return null;
  }
}

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
    !Array.isArray((body as { addresses?: unknown }).addresses)
  ) {
    return NextResponse.json({ error: "addresses array required" }, { status: 400 });
  }

  const addresses = (body as { addresses: unknown[] }).addresses
    .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    .slice(0, 10);

  // Google Geocoding API supports concurrent requests
  const settled = await Promise.allSettled(
    addresses.map((addr) => geocodeAddress(addr))
  );

  const results = addresses.map((address, i) => ({
    address,
    coords: settled[i].status === "fulfilled" ? settled[i].value : null,
  }));

  return NextResponse.json({ success: true, results });
}
