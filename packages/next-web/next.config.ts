import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pos/shared"],
  output: "export",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: { unoptimized: true },
};

export default nextConfig;
