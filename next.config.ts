import type { NextConfig } from "next";
import path from "path";

/** CSP: self + Giphy + Google fonts + media. Ajustar en OpenBSD si se añade Tor. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next hydration; endurecer en mirror si se pre-renderiza más
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self' https://api.giphy.com https://*.giphy.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-XSS-Protection", value: "0" }, // moderno: CSP, no legacy XSS filter
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // monorepo: evitar que Next tome el lockfile del repo padre
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/reproductormp3/:path*.m4a",
        headers: [
          { key: "Content-Type", value: "audio/mp4" },
          { key: "Accept-Ranges", value: "bytes" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/reproductormp3/:path*.mp3",
        headers: [
          { key: "Content-Type", value: "audio/mpeg" },
          { key: "Accept-Ranges", value: "bytes" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
