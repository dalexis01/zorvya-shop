import { NextResponse } from "next/server";

import { ensurePendingOrdersAssignedToBlocks } from "@/lib/server/admin/delivery-blocks-store";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const result = await ensurePendingOrdersAssignedToBlocks();
  return NextResponse.json({ success: true, ...result });
}
