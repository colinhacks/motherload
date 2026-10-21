import type { DocsTwoslashOptions } from 'docs-kit/mdx';

// Twoslash runs TypeScript's JavaScript API (6.0, from fumadocs-twoslash), which cannot run a
// content mapper. lib/remark-mapper.ts puts the modules Motherload's mapper returns into each
// block as hidden files, so the hovers show the real type. A data file's module imports nothing,
// so no package is mounted.
// docs-kit (docs-kit/src/mdx/twoslash.ts) adds the cache on disk, the `// @hover:` directive and
// the trimmed documentation.

export function motherloadTwoslash(): DocsTwoslashOptions {
  return {
    compilerOptions: {
      // `./config.toml` resolves to the hidden `config.d.toml.ts`.
      allowArbitraryExtensions: true,
      // `process.env` in the .env example.
      types: ['node'],
      strict: true,
    },
  };
}
