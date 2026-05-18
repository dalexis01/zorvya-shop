import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.sandbox.paypal.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://images.unsplash.com https://www.paypal.com https://*.googleapis.com https://*.gstatic.com https://*.public.blob.vercel-storage.com https://public.blob.vercel-storage.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "frame-src https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com",
      "connect-src 'self' https://api.paypal.com https://api.sandbox.paypal.com https://*.googleapis.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://*.tile.openstreetmap.org https://*.public.blob.vercel-storage.com https://public.blob.vercel-storage.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./data/**/*", "./db/migrations/**/*"],
  },
  images: {
    qualities: [75, 95],
    localPatterns: [
      { pathname: "/api/products/*/media" },
      { pathname: "/api/orders/*/items/*/image" },
      { pathname: "/api/homepage-media" },
    ],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
