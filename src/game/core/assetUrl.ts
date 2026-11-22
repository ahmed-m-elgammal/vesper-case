/**
 * Asset base-path support. When the game is deployed under a sub-path
 * (e.g. GitHub Pages project sites serve /vesper-case/), every absolute
 * asset/content URL must be prefixed with the deployment base. The base is
 * injected at build time via NEXT_PUBLIC_BASE_PATH (empty for local dev and
 * the standalone server, "/vesper-case" for the Pages export).
 */

export const ASSET_BASE: string = (process.env.NEXT_PUBLIC_BASE_PATH as string | undefined ?? '').replace(/\/+$/, '');

/** Prefix an absolute path with the deployment base; passes through anything else. */
export function withBase(p: string | null | undefined): string {
  if (!p || !p.startsWith('/') || /^(https?:|data:|blob:)/i.test(p)) return p ?? '';
  if (ASSET_BASE && p.startsWith(ASSET_BASE + '/')) return p; // idempotent
  return ASSET_BASE + p;
}
