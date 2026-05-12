import { NextResponse } from "next/server";

import { verifyAuthCode } from "@/lib/server/auth-codes";
import { createSessionForUser } from "@/lib/server/session";
import {
  findUserByEmail,
  markUserEmailVerified,
  toSessionUser,
  updateUserPassword,
} from "@/lib/server/users";
import { validatePasswordResetConfirmPayload } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const validation = validatePasswordResetConfirmPayload(payload);

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

    const codeMatches = await verifyAuthCode({
      userId: user.id,
      email: user.email,
      purpose: "reset-password",
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

    const updatedUser = await updateUserPassword(user.id, validation.data.password);

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          errors: {
            general: ["No se pudo actualizar la contrasena."],
          },
        },
        { status: 500 }
      );
    }

    const verifiedUser = updatedUser.emailVerifiedAt
      ? updatedUser
      : ((await markUserEmailVerified(updatedUser.id)) ?? updatedUser);

    await createSessionForUser(verifiedUser.id);

    return NextResponse.json({
      success: true,
      user: toSessionUser(verifiedUser),
      message: "Tu contrasena fue actualizada correctamente.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: {
          general: ["No se pudo restablecer la contrasena."],
        },
      },
      { status: 500 }
    );
  }
}
