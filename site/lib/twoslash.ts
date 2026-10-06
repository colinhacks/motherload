import { readFileSync } from 'node:fs';
import path from 'node:path';
import { transformerTwoslash } from 'fumadocs-twoslash';

// Twoslash runs TypeScript's JavaScript API (6.0, from fumadocs-twoslash), which cannot run a
// content mapper. lib/remark-mapper.ts puts the modules Motherload's mapper returns into each
// block as hidden files, and a schema's module imports its `Schema` type from `motherload`, which
// is mounted here from the repository's own source: the hovers show the real type and its docs.

/** Motherload's root export and every module it reaches through relative imports. */
function motherloadFiles(repo: string): Record<string, string> {
  const files: Record<string, string> = {
    'node_modules/motherload/package.json': readFileSync(path.join(repo, 'package.json'), 'utf8'),
  };
  // client.d.ts types `?raw` imports; the compiler options below list it, as a project's tsconfig does.
  const pending = ['src/index.ts', 'src/client.d.ts'];
  for (let file = pending.pop(); file; file = pending.pop()) {
    const key = `node_modules/motherload/${file}`;
    if (key in files) continue;
    const text = readFileSync(path.join(repo, file), 'utf8');
    files[key] = text;
    // Only the import declarations: Motherload names its own modules with their .ts extension.
    for (const [, spec] of text.matchAll(/^(?:import|export)\b[^;]*?\sfrom\s+["'](\.{1,2}\/[^"']+\.ts)["']/gm)) {
      pending.push(path.posix.join(path.posix.dirname(file), spec));
    }
  }
  return files;
}

export function motherloadTwoslash() {
  // The build runs in site/; the Motherload package is the repository root above it.
  const repo = path.resolve(process.cwd(), '..');
  return transformerTwoslash({
    twoslashOptions: {
      extraFiles: motherloadFiles(repo),
      compilerOptions: {
        // `./config.toml` resolves to the hidden `config.d.toml.ts`.
        allowArbitraryExtensions: true,
        // `process.env` in the .env example, and `?raw` imports.
        types: ['node', 'motherload/client'],
        // Motherload's source imports its own modules with their .ts extension, as the
        // repository's tsconfig allows; nothing on the site uses twoslash's emit.
        allowImportingTsExtensions: true,
        noEmit: true,
        strict: true,
      },
    },
  });
}
