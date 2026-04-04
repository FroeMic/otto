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
};

export default nextConfig;
