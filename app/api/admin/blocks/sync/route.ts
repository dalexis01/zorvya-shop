import { NextResponse } from "next/server";

import { ensurePendingOrdersAssignedToBlocks } from "@/lib/server/admin/delivery-blocks-store";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminRequestUser({
    request,
    permission: "blocks.manage",
  });
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const result = await ensurePendingOrdersAssignedToBlocks();
  return NextResponse.json({ success: true, ...result });
}
