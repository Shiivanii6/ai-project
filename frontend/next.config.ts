import type { NextConfig } from "next";
import path from "path";

// Keep builds rooted in this app (avoids wrong workspace when another lockfile exists in a parent folder).
const projectRoot = __dirname;

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
