import { NextResponse } from "next/server";

import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { addSupplierPayment } from "@/lib/server/admin/suppliers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const payload = (await request.json()) as {
      amount?: number;
      paymentDate?: string;
      blockId?: string | null;
      notes?: string;
    };

    const amount = Number(payload.amount ?? 0);

    if (!(amount > 0)) {
      return NextResponse.json(
        { success: false, error: "Monto invalido" },
        { status: 400 }
      );
    }

    const provider = await addSupplierPayment(
      id,
      {
        amount,
        paymentDate: payload.paymentDate,
        blockId: payload.blockId,
        notes: payload.notes,
      },
      auth.user.id
    );

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    console.error("Failed to register supplier payment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register supplier payment" },
      { status: 500 }
    );
  }
}
