import { NextResponse } from "next/server";

import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { createSupplier, getSupplierChoices, getSuppliers } from "@/lib/server/admin/suppliers";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const lite = searchParams.get("lite") === "1";

    if (lite) {
      const providers = await getSupplierChoices({ search });
      return NextResponse.json({ success: true, providers });
    }

    const providers = await getSuppliers({ search });
    return NextResponse.json({ success: true, providers });
  } catch (error) {
    console.error("Failed to get providers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get providers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const payload = (await request.json()) as {
      name?: string;
      contactName?: string;
      phone?: string;
      email?: string;
      notes?: string;
      isActive?: boolean;
    };

    if (!payload.name?.trim()) {
      return NextResponse.json(
        { success: false, error: "El nombre del proveedor es obligatorio" },
        { status: 400 }
      );
    }

    const provider = await createSupplier({
      name: payload.name.trim(),
      contactName: payload.contactName,
      phone: payload.phone,
      email: payload.email,
      notes: payload.notes,
      isActive: payload.isActive,
    });
    return NextResponse.json({ success: true, provider });
  } catch (error) {
    console.error("Failed to create provider:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create provider" },
      { status: 500 }
    );
  }
}
