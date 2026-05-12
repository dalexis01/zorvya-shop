import { NextResponse } from "next/server";

import { createAuthCode } from "@/lib/server/auth-codes";
import { sendVerificationCodeEmail } from "@/lib/server/auth-email";
import { createUser } from "@/lib/server/users";
import { validateRegistrationPayload } from "@/lib/server/validation";
import type { Locale } from "@/lib/shop/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const validation = validateRegistrationPayload(payload);
    const locale =
      payload && typeof payload === "object" && "locale" in payload
        ? (String((payload as Record<string, unknown>).locale) as Locale)
        : "es";

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    try {
      const user = await createUser(validation.data);
      const verificationCode = await createAuthCode({
        userId: user.id,
        email: user.email,
        purpose: "verify-email",
      });
      let message = "Revisa tu correo para verificar la cuenta.";

      try {
        await sendVerificationCodeEmail({
          email: user.email,
          name: user.name,
          code: verificationCode.code,
          locale,
        });
      } catch {
        message =
          "La cuenta fue creada, pero no se pudo enviar el codigo. Usa reenviar codigo para intentarlo de nuevo.";
      }

      return NextResponse.json(
        {
          success: true,
          user: null,
          nextStep: "verify-email",
          email: user.email,
          message,
        },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            success: false,
            errors: {
              email: ["Este correo ya esta registrado."],
            },
          },
          { status: 409 }
        );
      }

      if (error instanceof Error && error.message === "PHONE_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            success: false,
            errors: {
              phone: ["Este telefono ya esta registrado."],
            },
          },
          { status: 409 }
        );
      }

      throw error;
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: {
          general: ["No se pudo crear la cuenta."],
        },
      },
      { status: 500 }
    );
  }
}
