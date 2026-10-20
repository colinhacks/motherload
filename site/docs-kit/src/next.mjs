import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';

/**
 * A docs site's Next.js config: the site's own config with fumadocs-mdx, and these defaults under
 * it (a key the site sets wins, and its `serverExternalPackages` are added to these):
 *
 * - `reactStrictMode`; `agentRules: false`, since `next dev` would otherwise write AGENTS.md and
 *   CLAUDE.md into the site; `devIndicators: false`.
 * - `turbopack.root` at the directory `next` runs in: a site inside a repository with a lockfile of
 *   its own is a project by itself.
 * - TypeScript and Twoslash, which Twoslash loads at build time, never bundled.
 * - In `next dev`, ./mdx-dev-loader.mjs after fumadocs-mdx's loader, which keeps the dev server's
 *   memory flat across edits: without it a large page ran `next dev` out of an 8 GB heap on the
 *   first render after an edit.
 *
 * @param {import('next').NextConfig} [config]
 * @param {Parameters<typeof createMDX>[0]} [mdx] fumadocs-mdx's options
 * @returns {import('next').NextConfig}
 */
export function withDocsKit(config = {}, mdx) {
  const root = config.turbopack?.root ?? process.cwd();
  const merged = createMDX(mdx)({
    reactStrictMode: true,
    agentRules: false,
    devIndicators: false,
    ...config,
    turbopack: { ...config.turbopack, root },
    serverExternalPackages: [...new Set(['typescript', 'twoslash', ...(config.serverExternalPackages ?? [])])],
  });
  // Loaders run last to first, so this one runs after fumadocs-mdx's. Turbopack resolves a loader
  // from the project root, which holds this file (the site's copy of docs-kit, or its install).
  if (process.env.NODE_ENV === 'development') {
    const loader = path.relative(root, fileURLToPath(new URL('./mdx-dev-loader.mjs', import.meta.url)));
    merged.turbopack.rules['*.{md,mdx}'].loaders.unshift({ loader: loader.startsWith('.') ? loader : `./${loader}` });
  }
  return merged;
}
