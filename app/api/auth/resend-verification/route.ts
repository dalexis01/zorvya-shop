import { NextResponse } from "next/server";

import { createAuthCode } from "@/lib/server/auth-codes";
import { sendVerificationCodeEmail } from "@/lib/server/auth-email";
import { findUserByEmail } from "@/lib/server/users";
import { validatePasswordResetRequestPayload } from "@/lib/server/validation";
import type { Locale } from "@/lib/shop/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
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

    if (!user) {
      return NextResponse.json({
        success: true,
        message: "Si el correo existe, enviaremos un nuevo codigo.",
      });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({
        success: true,
        message: "La cuenta ya estaba verificada.",
      });
    }

    const verificationCode = await createAuthCode({
      userId: user.id,
      email: user.email,
      purpose: "verify-email",
    });

    await sendVerificationCodeEmail({
      email: user.email,
      name: user.name,
      code: verificationCode.code,
      locale,
    });

    return NextResponse.json({
      success: true,
      message: "Te enviamos un nuevo codigo de verificacion.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: {
          general: ["No se pudo reenviar el codigo ahora mismo."],
        },
      },
      { status: 500 }
    );
  }
}
