import { NextResponse } from "next/server";

import { verifyAuthCode } from "@/lib/server/auth-codes";
import { createSessionForUser } from "@/lib/server/session";
import { findUserByEmail, markUserEmailVerified, toSessionUser } from "@/lib/server/users";
import { validateVerificationCodePayload } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
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

    const user = await findUserByEmail(validation.data.email);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          errors: {
            email: ["No encontramos una cuenta con ese correo."],
          },
        },
        { status: 404 }
      );
    }

    if (!user.emailVerifiedAt) {
      const codeMatches = await verifyAuthCode({
        userId: user.id,
        email: user.email,
        purpose: "verify-email",
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
    }

    const verifiedUser = (await markUserEmailVerified(user.id)) ?? user;
    await createSessionForUser(verifiedUser.id);

    return NextResponse.json({
      success: true,
      user: toSessionUser(verifiedUser),
      message: "La cuenta fue verificada correctamente.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: {
          general: ["No se pudo verificar la cuenta."],
        },
      },
      { status: 500 }
    );
  }
}
