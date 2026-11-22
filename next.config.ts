import type { NextConfig } from "next";

/**
 * Two build modes:
 *  - default (no NEXT_PUBLIC_BASE_PATH): standalone server output, used by
 *    `npm run dev` / `npm run build` / `npm start` locally and in preview.
 *  - NEXT_PUBLIC_BASE_PATH="/vesper-case": fully static export for GitHub
 *    Pages project sites, where every asset/content URL is prefixed with the
 *    repo base (the game reads the env var through src/game/core/assetUrl.ts).
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const isPagesExport = BASE_PATH.startsWith("/");

const nextConfig: NextConfig = {
  ...(isPagesExport
    ? { output: "export" as const, basePath: BASE_PATH, trailingSlash: true }
    : { output: "standalone" as const }),
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
