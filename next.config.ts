import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // monorepo: evitar que Next tome el lockfile del repo padre
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
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
