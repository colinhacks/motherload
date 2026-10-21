import path from 'node:path';
import type { DocsTwoslashOptions } from 'docs-kit/mdx';

// Twoslash runs TypeScript's JavaScript API (6.0, from fumadocs-twoslash), which cannot run a
// content mapper. lib/remark-mapper.ts puts the modules Motherload's mapper returns into each
// block as hidden files, and a schema's module imports its `Schema` type from `motherload`, which
// re-exports @motherload/schema's; both are mounted from the repository's own source, so the hovers
// show the real type and its docs.
// docs-kit (docs-kit/src/mdx/twoslash.ts) adds the cache on disk, the `// @hover:` directive and
// the trimmed documentation.

export function motherloadTwoslash(): DocsTwoslashOptions {
  // The build runs in site/; the Motherload package is the repository root above it.
  const repo = path.resolve(process.cwd(), '..');
  return {
    // motherload's types re-export @motherload/schema's, so both are mounted.
    packages: [
      { name: 'motherload', root: repo, entries: ['src/index.ts'] },
      { name: '@motherload/schema', root: path.join(repo, 'packages/schema'), entries: ['src/index.ts'] },
    ],
    compilerOptions: {
      // `./config.toml` resolves to the hidden `config.d.toml.ts`.
      allowArbitraryExtensions: true,
      // `process.env` in the .env example.
      types: ['node'],
      strict: true,
    },
  };
}
