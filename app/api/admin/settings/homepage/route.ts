import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import {
  getHomepageSettings,
  HOMEPAGE_SETTINGS_TAG,
  updateHomepageSettings,
} from "@/lib/server/admin/homepage-settings";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminRequestUser();

  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const settings = await getHomepageSettings();

  return NextResponse.json({
    success: true,
    settings,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdminRequestUser();

  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const settings = await updateHomepageSettings(payload);
    revalidateTag(HOMEPAGE_SETTINGS_TAG, { expire: 0 });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron guardar los ajustes.",
      },
      { status: 500 }
    );
  }
}
