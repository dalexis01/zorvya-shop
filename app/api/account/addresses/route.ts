import { NextResponse } from "next/server";

import { createAddress, getAddressesByUserId } from "@/lib/server/addresses";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });

  const addresses = await getAddressesByUserId(user.id);
  return NextResponse.json({ success: true, addresses });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;

  const addressLine = typeof body.addressLine === "string" ? body.addressLine.trim() : "";
  if (addressLine.length < 5) {
    return NextResponse.json({ success: false, error: "La dirección es demasiado corta." }, { status: 400 });
  }

  const address = await createAddress(user.id, {
    label: typeof body.label === "string" ? body.label : "Mi dirección",
    addressLine,
    city: typeof body.city === "string" ? body.city : undefined,
    country: typeof body.country === "string" ? body.country : undefined,
    reference: typeof body.reference === "string" ? body.reference : undefined,
    latitude: typeof body.latitude === "number" ? body.latitude : undefined,
    longitude: typeof body.longitude === "number" ? body.longitude : undefined,
    isDefault: body.isDefault === true,
  });

  return NextResponse.json({ success: true, address }, { status: 201 });
}
