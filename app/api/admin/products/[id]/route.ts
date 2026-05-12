import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { createStatusLog } from "@/lib/server/admin/logs";
import { deleteProduct, getProductById, updateProduct } from "@/lib/server/admin/products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { STOREFRONT_PRODUCTS_TAG } from "@/lib/server/catalog";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to update product";
}

function toLoggableValue(field: string, value: unknown) {
  if (field === "images" && Array.isArray(value)) {
    return `${value.length} imagen(es)`;
  }

  if (field === "internal" && value && typeof value === "object") {
    const internal = value as Record<string, unknown>;

    return {
      costPrice: internal.costPrice ?? null,
      shippingFee: internal.shippingFee ?? null,
      supplier: internal.supplier ?? "",
      internalNotes: internal.internalNotes ?? "",
    };
  }

  return value;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const product = await getProductById(id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Failed to get product:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get product",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const payload = await request.json();

    const product = await updateProduct(id, payload, auth.user.id);

    await createStatusLog({
      type: "product",
      targetId: id,
      action: "updated",
      changedBy: auth.user.id,
      changedByName: auth.user.name,
      changes: Object.entries(payload).map(([field, value]) => ({
        field,
        oldValue: null,
        newValue: toLoggableValue(field, value),
      })),
    });
    revalidateTag(STOREFRONT_PRODUCTS_TAG, { expire: 0 });

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error: unknown) {
    console.error("Failed to update product:", error);

    const message = getErrorMessage(error);

    if (message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    if (message === "SKU_ALREADY_EXISTS") {
      return NextResponse.json(
        {
          success: false,
          error: "SKU already exists",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    if (auth.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only admins can delete products" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const product = await getProductById(id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    await deleteProduct(id);

    await createStatusLog({
      type: "product",
      targetId: id,
      action: "deleted",
      changedBy: auth.user.id,
      changedByName: auth.user.name,
      changes: [
        {
          field: "product_deleted",
          oldValue: product.name,
          newValue: null,
        },
      ],
    });
    revalidateTag(STOREFRONT_PRODUCTS_TAG, { expire: 0 });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to delete product:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete product",
      },
      { status: 500 }
    );
  }
}
