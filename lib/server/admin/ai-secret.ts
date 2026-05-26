import "server-only";

export function isValidAiAdminSecret(request: Request) {
  const expectedSecret = process.env.ZORVYA_ADMIN_API_SECRET?.trim();
  const providedSecret = request.headers.get("x-zorvya-ai-secret")?.trim() ?? "";

  if (!expectedSecret) {
    return {
      ok: false,
      status: 503,
      error: "ZORVYA_ADMIN_API_SECRET no configurado.",
    };
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return {
      ok: false,
      status: 401,
      error: "Secret IA invalido.",
    };
  }

  return {
    ok: true,
    status: 200,
    error: null,
  };
}
