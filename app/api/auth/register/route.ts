import { NextResponse } from "next/server";

import { createAuthCode } from "@/lib/server/auth-codes";
import { recordAuthSecurityEvent, buildRequestSecurityContext } from "@/lib/server/auth-security";
import {
  getAuthEmailDebugConfig,
  sendVerificationCodeEmail,
  sendWelcomeSecurityEmail,
} from "@/lib/server/auth-email";
import { createUser } from "@/lib/server/users";
import { validateRegistrationPayload } from "@/lib/server/validation";
import type { Locale } from "@/lib/shop/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const securityContext = buildRequestSecurityContext(request);
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
      await recordAuthSecurityEvent({
        userId: user.id,
        email: user.email,
        eventType: "account-created",
        success: true,
        ...securityContext,
      });
      const verificationCode = await createAuthCode({
        userId: user.id,
        email: user.email,
        purpose: "verify-email",
      });
      try {
        await sendVerificationCodeEmail({
          email: user.email,
          name: user.name,
          code: verificationCode.code,
          locale,
        });
        await sendWelcomeSecurityEmail({
          email: user.email,
          name: user.name,
          locale,
        });
      } catch (error) {
        console.error("[auth/register] failed to send verification email", {
          email: user.email,
          locale,
          emailConfig: getAuthEmailDebugConfig(),
          error,
        });

        return NextResponse.json(
          {
            success: false,
            nextStep: "verify-email",
            email: user.email,
            errors: {
              general: [
                "La cuenta fue creada, pero no pudimos enviar el codigo al correo. Revisa la configuracion de correo y usa reenviar codigo.",
              ],
            },
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          user: null,
          nextStep: "verify-email",
          email: user.email,
          message: "Revisa tu correo para verificar la cuenta.",
        },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            success: false,
            errors: {
              email: ["Este correo ya esta registrado. Inicia sesion o recupera tu cuenta."],
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

      if (error instanceof Error && error.message === "AUTH_CODE_RATE_LIMIT") {
        return NextResponse.json(
          {
            success: false,
            errors: {
              general: ["Espera unos minutos antes de solicitar otro codigo."],
            },
          },
          { status: 429 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[auth/register] unexpected error", error);
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
