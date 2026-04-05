import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        hostname: "models.dev",
        pathname: "/logos/**",
        protocol: "https",
      },
    ],
  },
  reactCompiler: true,
  serverExternalPackages: ["ssh2", "ssh2-sftp-client"],
};

export default nextConfig;
