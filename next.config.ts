import type { NextConfig } from "next";

// NEXT_PUBLIC_* values are inlined at build time, and `src/lib/env.ts` falls back to the local
// API when this one is missing, so a production deploy built without it would ship a bundle that
// calls each visitor's own localhost. Vercel sets VERCEL_ENV on the builds it runs.
if (
  process.env.VERCEL_ENV === "production" &&
  !process.env.NEXT_PUBLIC_API_BASE_URL
) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL must be set for a production build (Vercel → Settings → Environment Variables).",
  );
}

const nextConfig: NextConfig = {
  // No other site may frame the app: a hidden frame could steer a signed-in user's clicks onto
  // Delete or Save (clickjacking). X-Frame-Options covers browsers without frame-ancestors.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
