import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep tracing inside ai-session-7 (repo also has a root lockfile)
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
