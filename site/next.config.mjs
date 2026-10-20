import { withDocsKit } from 'docs-kit/next';

// docs-kit's config (docs-kit/src/next.mjs): fumadocs-mdx; TypeScript and Twoslash kept out of the
// bundle, since lib/twoslash.ts loads them at build time; no AGENTS.md or CLAUDE.md from next dev;
// and, in next dev only, the loader that keeps the dev server's memory flat across edits.
export default withDocsKit({
  // The repository root has a lockfile of its own; the site is a project by itself.
  turbopack: { root: import.meta.dirname },
});
