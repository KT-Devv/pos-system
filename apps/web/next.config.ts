import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pos/shared"],
  output: "export",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: { unoptimized: true },
  webpack(config) {
    // packages/shared is ESM and imports its own files with a ".js" extension (required by Node's
    // test runner). Let the bundler resolve those to the TypeScript sources.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
