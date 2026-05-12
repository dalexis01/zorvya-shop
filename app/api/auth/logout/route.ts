import { NextResponse } from "next/server";

import { destroyCurrentSession } from "@/lib/server/session";

export async function POST() {
  await destroyCurrentSession();

  return NextResponse.json({
    success: true,
  });
}
