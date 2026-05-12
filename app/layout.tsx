import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Sora } from "next/font/google";
import { cookies } from "next/headers";

import { STORE_BRAND } from "@/lib/shop/config";
import { CLIENT_THEME_COOKIE_KEY, normalizeClientTheme } from "@/lib/shop/client-theme";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: `${STORE_BRAND} Delivery`,
  description:
    "Tienda online local con carrito completo, checkout por efectivo y soporte en tiempo real.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialClientTheme = normalizeClientTheme(
    cookieStore.get(CLIENT_THEME_COOKIE_KEY)?.value,
    "dark"
  );

  return (
    <html
      lang="en"
      data-client-theme={initialClientTheme}
      suppressHydrationWarning
      className={`h-full antialiased ${manrope.className} ${manrope.variable} ${inter.variable} ${sora.variable}`}
    >
      <body className="min-h-full flex flex-col bg-[#02030a] text-slate-100">
        {children}
        {modal}
      </body>
    </html>
  );
}
