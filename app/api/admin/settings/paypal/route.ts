import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  getPayPalSettingsMeta,
  updatePayPalSettings,
} from "@/lib/server/admin/paypal-settings";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminRequestUser();

  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const result = await getPayPalSettingsMeta();

  return NextResponse.json({
    success: true,
    settings: result.settings,
    configured: result.configured,
    source: result.source,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdminRequestUser();

  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const settings = await updatePayPalSettings(payload);
    const configured = Boolean(settings.enabled && settings.clientId && settings.clientSecret);

    revalidatePath("/");

    return NextResponse.json({
      success: true,
      settings,
      configured,
      source: "admin" as const,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo guardar la configuracion de PayPal.",
      },
      { status: 500 }
    );
  }
}
