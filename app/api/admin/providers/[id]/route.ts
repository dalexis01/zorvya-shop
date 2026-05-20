import { NextResponse } from "next/server";

import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getSupplierProfile, updateSupplier } from "@/lib/server/admin/suppliers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const provider = await getSupplierProfile(id);

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Proveedor no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    console.error("Failed to get provider:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get provider" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
      name?: string;
      contactName?: string;
      phone?: string;
      email?: string;
      notes?: string;
      isActive?: boolean;
    };

    const provider = await updateSupplier(id, payload);

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Proveedor no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    console.error("Failed to update provider:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update provider" },
      { status: 500 }
    );
  }
}
