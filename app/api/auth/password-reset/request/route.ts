import { NextResponse } from "next/server";

import { createAuthCode } from "@/lib/server/auth-codes";
import { buildRequestSecurityContext, recordAuthSecurityEvent } from "@/lib/server/auth-security";
import { sendPasswordResetCodeEmail } from "@/lib/server/auth-email";
import { findUserByEmail } from "@/lib/server/users";
import { validatePasswordResetRequestPayload } from "@/lib/server/validation";
import type { Locale } from "@/lib/shop/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const securityContext = buildRequestSecurityContext(request);
    const validation = validatePasswordResetRequestPayload(payload);
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

    const user = await findUserByEmail(validation.data.email);

    if (user) {
      await recordAuthSecurityEvent({
        userId: user.id,
        email: user.email,
        eventType: "password-reset-request",
        success: true,
        ...securityContext,
      });
      const resetCode = await createAuthCode({
        userId: user.id,
        email: user.email,
        purpose: "reset-password",
      });

      await sendPasswordResetCodeEmail({
        email: user.email,
        name: user.name,
        code: resetCode.code,
        locale,
      });
    } else {
      await recordAuthSecurityEvent({
        email: validation.data.email,
        eventType: "password-reset-request",
        success: false,
        ...securityContext,
        metadata: {
          reason: "email-not-found",
        },
      });
    }

    return NextResponse.json({
      success: true,
      nextStep: "reset-password",
      email: validation.data.email,
      message: "Si el correo existe, te enviamos un codigo para recuperar la cuenta.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: {
          general: ["No se pudo enviar el codigo de recuperacion."],
        },
      },
      { status: 500 }
    );
  }
}
