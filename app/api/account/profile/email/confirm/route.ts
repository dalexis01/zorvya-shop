import { NextResponse } from "next/server";

import { verifyAuthCode } from "@/lib/server/auth-codes";
import { getCurrentUser } from "@/lib/server/session";
import { findUserByEmail, toSessionUser, updateUserEmail } from "@/lib/server/users";
import { validateVerificationCodePayload } from "@/lib/server/validation";

export async function POST(request: Request) {
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

    const payload = (await request.json()) as unknown;
    const validation = validateVerificationCodePayload(payload);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const nextEmail = validation.data.email;

    if (nextEmail === user.email.trim().toLowerCase()) {
      return NextResponse.json(
        {
          success: true,
          user,
          message: "Ese correo ya estaba confirmado en tu cuenta.",
        },
        { status: 200 }
      );
    }

    const existingUser = await findUserByEmail(nextEmail);

    if (existingUser && existingUser.id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          errors: {
            email: ["Ese correo ya esta registrado en otra cuenta."],
          },
        },
        { status: 409 }
      );
    }

    const codeMatches = await verifyAuthCode({
      userId: user.id,
      email: nextEmail,
      purpose: "change-email",
      code: validation.data.code,
    });

    if (!codeMatches) {
      return NextResponse.json(
        {
          success: false,
          errors: {
            code: ["El codigo no es valido o ya vencio."],
          },
        },
        { status: 400 }
      );
    }

    let updatedUser = null;

    try {
      updatedUser = await updateUserEmail(user.id, nextEmail);
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            success: false,
            errors: {
              email: ["Ese correo ya esta registrado en otra cuenta."],
            },
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
          errors: {
            general: ["No se pudo actualizar el correo de la cuenta."],
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: toSessionUser(updatedUser),
      message: "El correo fue confirmado y actualizado correctamente.",
    });
  } catch (error) {
    console.error("Failed to confirm account email change:", error);

    return NextResponse.json(
      {
        success: false,
        errors: {
          general: ["No se pudo confirmar el nuevo correo."],
        },
      },
      { status: 500 }
    );
  }
}
