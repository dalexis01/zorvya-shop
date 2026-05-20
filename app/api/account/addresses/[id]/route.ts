import { NextResponse } from "next/server";

import { deleteAddress, updateAddress } from "@/lib/server/addresses";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/account/addresses/[id]">
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const updated = await updateAddress(id, user.id, {
    label: typeof body.label === "string" ? body.label : undefined,
    addressLine: typeof body.addressLine === "string" ? body.addressLine : undefined,
    city: typeof body.city === "string" ? body.city : undefined,
    country: typeof body.country === "string" ? body.country : undefined,
    reference: typeof body.reference === "string" ? body.reference : undefined,
    setDefault: body.setDefault === true,
  });

  if (!updated) {
    return NextResponse.json({ success: false, error: "Dirección no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ success: true, address: updated });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/account/addresses/[id]">
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });

  const { id } = await context.params;
  const deleted = await deleteAddress(id, user.id);

  if (!deleted) {
    return NextResponse.json({ success: false, error: "Dirección no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
