import "server-only";

import { Resend } from "resend";

import type { Locale } from "@/lib/shop/types";

const copyByLocale: Record<
  Locale,
  {
    verifySubject: string;
    verifyHeading: string;
    verifyBody: string;
    changeEmailSubject: string;
    changeEmailHeading: string;
    changeEmailBody: string;
    resetSubject: string;
    resetHeading: string;
    resetBody: string;
    expiry: string;
  }
> = {
  es: {
    verifySubject: "Codigo de verificacion de tu cuenta",
    verifyHeading: "Verifica tu cuenta",
    verifyBody: "Usa este codigo para verificar tu cuenta y activar el acceso.",
    changeEmailSubject: "Codigo para confirmar tu nuevo correo",
    changeEmailHeading: "Confirma tu nuevo correo",
    changeEmailBody: "Usa este codigo para confirmar el nuevo correo asociado a tu cuenta.",
    resetSubject: "Codigo para recuperar tu contrasena",
    resetHeading: "Recupera tu contrasena",
    resetBody: "Usa este codigo para cambiar tu contrasena de forma segura.",
    expiry: "Este codigo vence en 15 minutos.",
  },
  nl: {
    verifySubject: "Verificatiecode voor je account",
    verifyHeading: "Verifieer je account",
    verifyBody: "Gebruik deze code om je account te verifieren en toegang te activeren.",
    changeEmailSubject: "Code om je nieuwe e-mail te bevestigen",
    changeEmailHeading: "Bevestig je nieuwe e-mail",
    changeEmailBody: "Gebruik deze code om het nieuwe e-mailadres van je account te bevestigen.",
    resetSubject: "Code om je wachtwoord te herstellen",
    resetHeading: "Herstel je wachtwoord",
    resetBody: "Gebruik deze code om je wachtwoord veilig te wijzigen.",
    expiry: "Deze code verloopt over 15 minuten.",
  },
  en: {
    verifySubject: "Your account verification code",
    verifyHeading: "Verify your account",
    verifyBody: "Use this code to verify your account and activate access.",
    changeEmailSubject: "Code to confirm your new email",
    changeEmailHeading: "Confirm your new email",
    changeEmailBody: "Use this code to confirm the new email address linked to your account.",
    resetSubject: "Your password recovery code",
    resetHeading: "Recover your password",
    resetBody: "Use this code to change your password securely.",
    expiry: "This code expires in 15 minutes.",
  },
  pt: {
    verifySubject: "Codigo de verificacao da sua conta",
    verifyHeading: "Verifique sua conta",
    verifyBody: "Use este codigo para verificar sua conta e ativar o acesso.",
    changeEmailSubject: "Codigo para confirmar seu novo e-mail",
    changeEmailHeading: "Confirme seu novo e-mail",
    changeEmailBody: "Use este codigo para confirmar o novo e-mail vinculado a sua conta.",
    resetSubject: "Codigo para recuperar sua senha",
    resetHeading: "Recupere sua senha",
    resetBody: "Use este codigo para alterar sua senha com seguranca.",
    expiry: "Este codigo expira em 15 minutos.",
  },
};

function getEmailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
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
    throw new Error("RESEND_API_KEY_MISSING");
  }

  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL_MISSING");
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: input.subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>${escapeHtml(input.heading)}</h2>
        <p>Hola ${escapeHtml(input.name || "cliente")},</p>
        <p>${escapeHtml(input.body)}</p>
        <div style="margin: 18px 0; display: inline-block; padding: 14px 20px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe; font-size: 28px; font-weight: 800; letter-spacing: 0.18em;">
          ${escapeHtml(input.code)}
        </div>
        <p>${escapeHtml(input.expiry)}</p>
      </div>
    `,
  });
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
