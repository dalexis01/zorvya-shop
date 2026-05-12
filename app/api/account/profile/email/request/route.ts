import { NextResponse } from "next/server";

import { createAuthCode } from "@/lib/server/auth-codes";
import { sendChangeEmailCodeEmail } from "@/lib/server/auth-email";
import { getCurrentUser } from "@/lib/server/session";
import { findUserByEmail } from "@/lib/server/users";
import { validatePasswordResetRequestPayload } from "@/lib/server/validation";
import type { Locale } from "@/lib/shop/types";

function resolveLocale(payload: unknown): Locale {
  if (payload && typeof payload === "object" && "locale" in payload) {
    const locale = String((payload as Record<string, unknown>).locale);
    if (locale === "es" || locale === "nl" || locale === "en" || locale === "pt") {
      return locale;
    }
  }

  return "es";
}

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
    const validation = validatePasswordResetRequestPayload(payload);
    const locale = resolveLocale(payload);

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
          success: false,
          errors: {
            email: ["Ese correo ya esta vinculado a tu cuenta."],
          },
        },
        { status: 400 }
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

    const verificationCode = await createAuthCode({
      userId: user.id,
      email: nextEmail,
      purpose: "change-email",
    });

    await sendChangeEmailCodeEmail({
      email: nextEmail,
      name: user.name,
      code: verificationCode.code,
      locale,
    });

    return NextResponse.json({
      success: true,
      email: nextEmail,
      message: "Te enviamos un codigo al nuevo correo para confirmarlo.",
    });
  } catch (error) {
    console.error("Failed to request account email change:", error);

    return NextResponse.json(
      {
        success: false,
        errors: {
          general: ["No se pudo enviar el codigo al nuevo correo."],
        },
      },
      { status: 500 }
    );
  }
}
