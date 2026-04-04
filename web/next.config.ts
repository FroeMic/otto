import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
