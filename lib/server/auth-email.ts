import "server-only";

import { Resend } from "resend";

import type { Locale } from "@/lib/shop/types";
import { buildAuthCodeEmail, buildSecurityNoticeEmail, buildWelcomeEmail } from "@/lib/server/email-templates";

const copyByLocale: Record<
  Locale,
  {
    verifySubject: string;
    verifyHeading: string;
    verifyBody: string;
    welcomeSubject: string;
    welcomeHeading: string;
    welcomeBody: string;
    changeEmailSubject: string;
    changeEmailHeading: string;
    changeEmailBody: string;
    resetSubject: string;
    resetHeading: string;
    resetBody: string;
    passwordChangedSubject: string;
    passwordChangedHeading: string;
    passwordChangedBody: string;
    newDeviceSubject: string;
    newDeviceHeading: string;
    newDeviceBody: string;
    expiry: string;
  }
> = {
  es: {
    verifySubject: "Codigo de verificacion de tu cuenta",
    verifyHeading: "Verifica tu cuenta",
    verifyBody: "Usa este codigo para verificar tu cuenta y activar el acceso.",
    welcomeSubject: "Tu cuenta fue creada",
    welcomeHeading: "Cuenta creada correctamente",
    welcomeBody: "Se creo una nueva cuenta con este correo. Si no fuiste tu, cambia tu contrasena cuanto antes.",
    changeEmailSubject: "Codigo para confirmar tu nuevo correo",
    changeEmailHeading: "Confirma tu nuevo correo",
    changeEmailBody: "Usa este codigo para confirmar el nuevo correo asociado a tu cuenta.",
    resetSubject: "Codigo para recuperar tu contrasena",
    resetHeading: "Recupera tu contrasena",
    resetBody: "Usa este codigo para cambiar tu contrasena de forma segura.",
    passwordChangedSubject: "Tu contrasena fue cambiada",
    passwordChangedHeading: "Contrasena actualizada",
    passwordChangedBody: "Tu contrasena fue actualizada correctamente. Si no reconoces este cambio, contacta a soporte de inmediato.",
    newDeviceSubject: "Nuevo inicio de sesion detectado",
    newDeviceHeading: "Nuevo dispositivo detectado",
    newDeviceBody: "Detectamos un inicio de sesion desde un dispositivo o navegador nuevo. Si no fuiste tu, cambia tu contrasena.",
    expiry: "Este codigo vence en 15 minutos.",
  },
  nl: {
    verifySubject: "Verificatiecode voor je account",
    verifyHeading: "Verifieer je account",
    verifyBody: "Gebruik deze code om je account te verifieren en toegang te activeren.",
    welcomeSubject: "Je account is aangemaakt",
    welcomeHeading: "Account succesvol aangemaakt",
    welcomeBody: "Er is een nieuwe account met dit e-mailadres aangemaakt. Was jij dit niet, wijzig dan zo snel mogelijk je wachtwoord.",
    changeEmailSubject: "Code om je nieuwe e-mail te bevestigen",
    changeEmailHeading: "Bevestig je nieuwe e-mail",
    changeEmailBody: "Gebruik deze code om het nieuwe e-mailadres van je account te bevestigen.",
    resetSubject: "Code om je wachtwoord te herstellen",
    resetHeading: "Herstel je wachtwoord",
    resetBody: "Gebruik deze code om je wachtwoord veilig te wijzigen.",
    passwordChangedSubject: "Je wachtwoord is gewijzigd",
    passwordChangedHeading: "Wachtwoord bijgewerkt",
    passwordChangedBody: "Je wachtwoord is succesvol gewijzigd. Als jij dit niet was, neem dan direct contact op met support.",
    newDeviceSubject: "Nieuw inlogapparaat gedetecteerd",
    newDeviceHeading: "Nieuw apparaat gedetecteerd",
    newDeviceBody: "We zagen een login vanaf een nieuw apparaat of nieuwe browser. Als jij dit niet was, wijzig dan je wachtwoord.",
    expiry: "Deze code verloopt over 15 minuten.",
  },
  en: {
    verifySubject: "Your account verification code",
    verifyHeading: "Verify your account",
    verifyBody: "Use this code to verify your account and activate access.",
    welcomeSubject: "Your account was created",
    welcomeHeading: "Account created successfully",
    welcomeBody: "A new account was created with this email address. If this was not you, change your password as soon as possible.",
    changeEmailSubject: "Code to confirm your new email",
    changeEmailHeading: "Confirm your new email",
    changeEmailBody: "Use this code to confirm the new email address linked to your account.",
    resetSubject: "Your password recovery code",
    resetHeading: "Recover your password",
    resetBody: "Use this code to change your password securely.",
    passwordChangedSubject: "Your password was changed",
    passwordChangedHeading: "Password updated",
    passwordChangedBody: "Your password was updated successfully. If you did not make this change, contact support immediately.",
    newDeviceSubject: "New login detected",
    newDeviceHeading: "New device detected",
    newDeviceBody: "We detected a login from a new device or browser. If this was not you, please change your password.",
    expiry: "This code expires in 15 minutes.",
  },
  pt: {
    verifySubject: "Codigo de verificacao da sua conta",
    verifyHeading: "Verifique sua conta",
    verifyBody: "Use este codigo para verificar sua conta e ativar o acesso.",
    welcomeSubject: "Sua conta foi criada",
    welcomeHeading: "Conta criada com sucesso",
    welcomeBody: "Uma nova conta foi criada com este e-mail. Se nao foi voce, altere sua senha o quanto antes.",
    changeEmailSubject: "Codigo para confirmar seu novo e-mail",
    changeEmailHeading: "Confirme seu novo e-mail",
    changeEmailBody: "Use este codigo para confirmar o novo e-mail vinculado a sua conta.",
    resetSubject: "Codigo para recuperar sua senha",
    resetHeading: "Recupere sua senha",
    resetBody: "Use este codigo para alterar sua senha com seguranca.",
    passwordChangedSubject: "Sua senha foi alterada",
    passwordChangedHeading: "Senha atualizada",
    passwordChangedBody: "Sua senha foi alterada com sucesso. Se voce nao reconhece esta mudanca, fale com o suporte imediatamente.",
    newDeviceSubject: "Novo login detectado",
    newDeviceHeading: "Novo dispositivo detectado",
    newDeviceBody: "Detectamos um login vindo de um novo dispositivo ou navegador. Se nao foi voce, altere sua senha.",
    expiry: "Este codigo expira em 15 minutos.",
  },
};

function getEmailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail:
      process.env.RESEND_FROM_EMAIL ||
      "Zorvya Shop <onboarding@resend.dev>",
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendAuthEmail(input: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  code: string;
  name: string;
  expiry: string;
}) {
  const { apiKey, fromEmail } = getEmailConfig();

  if (!apiKey) {
    throw new AuthEmailSendError("RESEND_API_KEY_MISSING", "RESEND_API_KEY_MISSING");
  }

  if (!fromEmail) {
    throw new AuthEmailSendError("RESEND_FROM_EMAIL_MISSING", "RESEND_FROM_EMAIL_MISSING");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: input.subject,
    html: buildAuthCodeEmail({
      heading: input.heading,
      body: input.body,
      code: input.code,
      name: input.name || "cliente",
      expiry: input.expiry,
    }),
  });

  if (result.error) {
    console.error("[auth-email] resend auth email failed", {
      to: input.to,
      subject: input.subject,
      fromEmail,
      error: result.error,
    });
    throw new AuthEmailSendError(
      `RESEND_SEND_FAILED: ${result.error.message}`,
      "RESEND_SEND_FAILED"
    );
  }
}

async function sendSecurityEmail(input: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  name: string;
  extra?: string;
}) {
  const { apiKey, fromEmail } = getEmailConfig();

  if (!apiKey) {
    throw new AuthEmailSendError("RESEND_API_KEY_MISSING", "RESEND_API_KEY_MISSING");
  }

  if (!fromEmail) {
    throw new AuthEmailSendError("RESEND_FROM_EMAIL_MISSING", "RESEND_FROM_EMAIL_MISSING");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: input.subject,
    html: buildSecurityNoticeEmail({
      heading: input.heading,
      body: input.body,
      name: input.name || "cliente",
      extra: input.extra,
    }),
  });

  if (result.error) {
    console.error("[auth-email] resend security email failed", {
      to: input.to,
      subject: input.subject,
      fromEmail,
      error: result.error,
    });
    throw new AuthEmailSendError(
      `RESEND_SEND_FAILED: ${result.error.message}`,
      "RESEND_SEND_FAILED"
    );
  }
}

export function getAuthEmailDebugConfig() {
  const { apiKey, fromEmail } = getEmailConfig();

  return {
    provider: "resend",
    hasApiKey: Boolean(apiKey),
    fromEmail,
  };
}

export async function sendVerificationCodeEmail(input: {
  email: string;
  name: string;
  code: string;
  locale: Locale;
}) {
  const copy = copyByLocale[input.locale] ?? copyByLocale.es;
  await sendAuthEmail({
    to: input.email,
    subject: copy.verifySubject,
    heading: copy.verifyHeading,
    body: copy.verifyBody,
    code: input.code,
    name: input.name,
    expiry: copy.expiry,
  });
}

export async function sendChangeEmailCodeEmail(input: {
  email: string;
  name: string;
  code: string;
  locale: Locale;
}) {
  const copy = copyByLocale[input.locale] ?? copyByLocale.es;
  await sendAuthEmail({
    to: input.email,
    subject: copy.changeEmailSubject,
    heading: copy.changeEmailHeading,
    body: copy.changeEmailBody,
    code: input.code,
    name: input.name,
    expiry: copy.expiry,
  });
}

export async function sendPasswordResetCodeEmail(input: {
  email: string;
  name: string;
  code: string;
  locale: Locale;
}) {
  const copy = copyByLocale[input.locale] ?? copyByLocale.es;
  await sendAuthEmail({
    to: input.email,
    subject: copy.resetSubject,
    heading: copy.resetHeading,
    body: copy.resetBody,
    code: input.code,
    name: input.name,
    expiry: copy.expiry,
  });
}

export async function sendWelcomeSecurityEmail(input: {
  email: string;
  name: string;
  locale: Locale;
}) {
  const { apiKey, fromEmail } = getEmailConfig();
  if (!apiKey) throw new AuthEmailSendError("RESEND_API_KEY_MISSING", "RESEND_API_KEY_MISSING");
  if (!fromEmail) throw new AuthEmailSendError("RESEND_FROM_EMAIL_MISSING", "RESEND_FROM_EMAIL_MISSING");

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: fromEmail,
    to: input.email,
    subject: "¡Bienvenido a ZorvyA Shop!",
    html: buildWelcomeEmail({ name: input.name }),
  });

  if (result.error) {
    throw new AuthEmailSendError(`RESEND_SEND_FAILED: ${result.error.message}`, "RESEND_SEND_FAILED");
  }
}

export async function sendPasswordChangedEmail(input: {
  email: string;
  name: string;
  locale: Locale;
}) {
  const copy = copyByLocale[input.locale] ?? copyByLocale.es;
  await sendSecurityEmail({
    to: input.email,
    subject: copy.passwordChangedSubject,
    heading: copy.passwordChangedHeading,
    body: copy.passwordChangedBody,
    name: input.name,
  });
}

export async function sendNewDeviceLoginEmail(input: {
  email: string;
  name: string;
  locale: Locale;
  extra?: string;
}) {
  const copy = copyByLocale[input.locale] ?? copyByLocale.es;
  await sendSecurityEmail({
    to: input.email,
    subject: copy.newDeviceSubject,
    heading: copy.newDeviceHeading,
    body: copy.newDeviceBody,
    name: input.name,
    extra: input.extra,
  });
}
class AuthEmailSendError extends Error {
  constructor(
    message: string,
    readonly code:
      | "RESEND_API_KEY_MISSING"
      | "RESEND_FROM_EMAIL_MISSING"
      | "RESEND_SEND_FAILED"
  ) {
    super(message);
    this.name = "AuthEmailSendError";
  }
}
