import { NextResponse } from "next/server";

import {
  getOrdersAdminSettings,
  updateOrdersAdminSettings,
} from "@/lib/server/admin/orders-settings";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  const settings = await getOrdersAdminSettings();
  return NextResponse.json({ success: true, settings });
}

export async function PUT(request: Request) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  try {
    const payload = (await request.json()) as { autoMode?: boolean };
    const settings = await updateOrdersAdminSettings({
      autoMode: typeof payload.autoMode === "boolean" ? payload.autoMode : undefined,
    });
    return NextResponse.json({ success: true, settings });
  } catch {
    return NextResponse.json(
      { success: false, error: "No se pudo guardar la configuracion." },
      { status: 500 }
    );
  }
}
