import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_STATIC_EXPORT !== "0";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isStaticExport ? "export" : undefined,
  assetPrefix: isStaticExport ? "./" : undefined,
  outputFileTracingRoot: process.cwd(),
  watchOptions: {
    pollIntervalMs: 1000
  },
  webpack: (config) => {
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: ["**/node_modules/**", "**/.git/**", "../hermes-agent/**"]
    };

    return config;
  }
};

export default nextConfig;
