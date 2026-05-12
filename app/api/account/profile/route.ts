import { NextResponse } from "next/server";

import { resolveDeliveryQuote } from "@/lib/server/delivery-quote";
import { getCurrentUser } from "@/lib/server/session";
import { toSessionUser, updateUserContact } from "@/lib/server/users";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado.",
        },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const name = normalizeText(payload.name);
    const phone = normalizeText(payload.phone);
    const address = normalizeText(payload.address);

    if (name.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "El nombre es demasiado corto.",
        },
        { status: 400 }
      );
    }

    if (address.length > 0) {
      const addressQuote = await resolveDeliveryQuote({
        address,
      });

      if (!addressQuote.isValidSurinameAddress) {
        return NextResponse.json(
          {
            success: false,
            error: "Solo se permiten direcciones reales de Suriname.",
          },
          { status: 400 }
        );
      }
    }

    let updatedUser = null;

    try {
      updatedUser = await updateUserContact(user.id, {
        name,
        phone,
        address,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PHONE_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            success: false,
            error: "Ese telefono ya esta vinculado a otra cuenta.",
          },
          { status: 409 }
        );
      }

      throw error;
    }

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo actualizar el perfil.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: toSessionUser(updatedUser),
    });
  } catch (error) {
    console.error("Failed to update account profile:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo actualizar el perfil.",
      },
      { status: 500 }
    );
  }
}
