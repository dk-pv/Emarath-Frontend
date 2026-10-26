import type { NextConfig } from "next";

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
