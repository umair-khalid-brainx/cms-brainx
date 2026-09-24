import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: without this, Turbopack walks up past this repo
  // looking for a lockfile and warns about one outside the project.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
