import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // monorepo: evitar que Next tome el lockfile del repo padre
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
