import { NextResponse } from "next/server";

import { createAuthCode } from "@/lib/server/auth-codes";
import { buildRequestSecurityContext, hasKnownLoginDevice, recordAuthSecurityEvent } from "@/lib/server/auth-security";
import { sendNewDeviceLoginEmail, sendVerificationCodeEmail } from "@/lib/server/auth-email";
import { createSessionForUser } from "@/lib/server/session";
import { authenticateUser, toSessionUser } from "@/lib/server/users";
import { validateLoginPayload } from "@/lib/server/validation";
import type { Locale } from "@/lib/shop/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const securityContext = buildRequestSecurityContext(request);
    const validation = validateLoginPayload(payload);
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

    const authResult = await authenticateUser(validation.data.email, validation.data.password);

    if (!authResult.success) {
      await recordAuthSecurityEvent({
        userId: authResult.user?.id ?? null,
        email: validation.data.email,
        eventType: "login-failed",
        success: false,
        ...securityContext,
        metadata: {
          reason: authResult.reason,
        },
      });

      if (authResult.reason === "unverified" && authResult.user) {
        const verificationCode = await createAuthCode({
          userId: authResult.user.id,
          email: authResult.user.email,
          purpose: "verify-email",
        });
        let message = "Tu cuenta aun no esta verificada. Revisa tu correo.";

        try {
          await sendVerificationCodeEmail({
            email: authResult.user.email,
            name: authResult.user.name,
            code: verificationCode.code,
            locale,
          });
        } catch {
          message =
            "Tu cuenta aun no esta verificada. No pudimos enviar el codigo ahora; intenta reenviarlo.";
        }

        return NextResponse.json(
          {
            success: false,
            nextStep: "verify-email",
            email: authResult.user.email,
            message,
            errors: {
              general: [message],
            },
          },
          { status: 403 }
        );
      }

      if (authResult.reason === "blocked") {
        return NextResponse.json(
          {
            success: false,
            errors: {
              general: ["Tu cuenta esta bloqueada temporalmente."],
            },
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          errors: {
            general: ["Correo, telefono o contrasena incorrectos."],
          },
        },
        { status: 401 }
      );
    }

    const isKnownDevice = await hasKnownLoginDevice(
      authResult.user.id,
      securityContext.deviceFingerprint
    );

    await createSessionForUser(authResult.user.id);
    await recordAuthSecurityEvent({
      userId: authResult.user.id,
      email: authResult.user.email,
      eventType: isKnownDevice ? "login-success" : "login-new-device",
      success: true,
      ...securityContext,
    });

    if (!isKnownDevice) {
      try {
        await sendNewDeviceLoginEmail({
          email: authResult.user.email,
          name: authResult.user.name,
          locale,
          extra: securityContext.ipAddress
            ? `IP detectada: ${securityContext.ipAddress}`
            : undefined,
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      user: toSessionUser(authResult.user),
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: {
          general: ["No se pudo iniciar sesion."],
        },
      },
      { status: 500 }
    );
  }
}
