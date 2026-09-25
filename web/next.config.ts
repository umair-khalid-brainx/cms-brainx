import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to CMS/ (one level up), not web/ itself: cms-blocks
  // is a sibling package outside web/, and Turbopack won't resolve a symlinked
  // module whose real path is outside its configured root.
  turbopack: { root: path.resolve("..") },
  // cms-blocks ships raw TS/TSX source (no build step, see D-010's reasoning
  // for Tailwind); Turbopack otherwise treats node_modules as pre-built.
  transpilePackages: ["cms-blocks"],
};

export default nextConfig;
