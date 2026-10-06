import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // next dev would otherwise write AGENTS.md and CLAUDE.md here.
  agentRules: false,
  devIndicators: false,
  // The repository root has a lockfile of its own; the site is a project by itself.
  turbopack: { root: import.meta.dirname },
  // Twoslash (lib/twoslash.ts) loads TypeScript at build time; it is never bundled.
  serverExternalPackages: ['typescript', 'twoslash'],
};

const withMDX = createMDX();

export default withMDX(config);
