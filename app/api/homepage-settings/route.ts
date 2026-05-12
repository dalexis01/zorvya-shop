import { NextResponse } from "next/server";

import { getStorefrontHomepageSettings } from "@/lib/server/admin/homepage-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getStorefrontHomepageSettings();

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron cargar los ajustes de la home.",
      },
      { status: 500 }
    );
  }
}
