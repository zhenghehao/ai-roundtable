import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  assetPrefix: "./",
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
