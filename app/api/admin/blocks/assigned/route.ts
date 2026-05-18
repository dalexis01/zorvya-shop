import { NextResponse } from "next/server";

import { getAssignedOrderIds } from "@/lib/server/admin/delivery-blocks-store";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

// Returns the list of order IDs already assigned to a delivery block.
// Replaces the broken HEAD handler (HTTP HEAD spec strips the body).
export async function GET() {
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  const assigned = await getAssignedOrderIds();
  return NextResponse.json({ success: true, assignedOrderIds: Array.from(assigned) });
}
