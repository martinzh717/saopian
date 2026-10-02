import type { NextConfig } from "next";

const isWeb = process.env.SAOPIAN_BUILD === "web";

const nextConfig: NextConfig = {
  output: isWeb ? "export" : "standalone",
  basePath: isWeb ? "/app/saopian" : undefined,
  // Local media uses /api/media + browser decode; no next/image optimizer needed.
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    "/*": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },
};

export default nextConfig;
