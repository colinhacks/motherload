import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultHoverInfoProcessor } from '@shikijs/twoslash';
import { transformerTwoslash } from 'fumadocs-twoslash';
import { createFileSystemTypesCache } from 'fumadocs-twoslash/cache-fs';

/**
 * A package to mount into every Twoslash block as `node_modules/<name>`, read from its own source:
 * a content mapper's site types its examples with the package's real types and docs. `root` is the
 * package's directory (holding its package.json); `entries` are its source files, from which every
 * module reached through a relative `import … from "./x.ts"` is mounted too.
 */
export type MountedPackage = { name: string; root: string; entries: string[] };

export function mountPackage({ name, root, entries }: MountedPackage): Record<string, string> {
  const files: Record<string, string> = {
    [`node_modules/${name}/package.json`]: readFileSync(path.join(root, 'package.json'), 'utf8'),
  };
  const pending = [...entries];
  for (let file = pending.pop(); file; file = pending.pop()) {
    const key = `node_modules/${name}/${file}`;
    if (key in files) continue;
    const text = readFileSync(path.join(root, file), 'utf8');
    files[key] = text;
    // Only the import declarations; a package written this way names its own modules with their
    // .ts extension.
    for (const [, spec] of text.matchAll(/^(?:import|export)\b[^;]*?\sfrom\s+["'](\.{1,2}\/[^"']+\.ts)["']/gm)) {
      pending.push(path.posix.join(path.posix.dirname(file), spec));
    }
  }
  return files;
}

export type DocsTwoslashOptions = {
  /** Packages mounted into every block from their source (`mountPackage`). */
  packages?: MountedPackage[];
  /** Compiler options for every block, over `noEmit` and `allowImportingTsExtensions`. */
  compilerOptions?: Record<string, unknown>;
  /** A last rewrite of each hover's text, after Shiki's default processing. */
  processHoverInfo?: (info: string) => string;
  /** Documentation longer than this many characters is left out of a popup (default 400). */
  docsLimit?: number;
};

/** The options every block is checked with; scripts and tests reach Twoslash through these too. */
export function twoslashOptions({ packages = [], compilerOptions = {} }: DocsTwoslashOptions = {}) {
  return {
    extraFiles: Object.assign({}, ...packages.map(mountPackage)) as Record<string, string>,
    compilerOptions: {
      // A mounted package's source imports its own modules with their .ts extension; nothing on
      // the site uses Twoslash's emit.
      allowImportingTsExtensions: true,
      noEmit: true,
      ...compilerOptions,
    },
  };
}

/**
 * A block with a `// @hover: <names>` line, written as Twoslash writes its own flags, keeps the
 * popups of the identifiers it names, every occurrence of each, and no other: the rest of its code
 * renders as plain highlighted code, with no popup and no dotted underline. The names are separated
 * by spaces or commas, and several such lines add up. A block without the line keeps every popup.
 * Errors and `^?` queries are kept whatever the line says, since they are not hovers.
 *
 * The line is taken out before Twoslash sees the code, not left to Twoslash as a custom tag:
 * Shiki's transformer passes Twoslash its own default tags on every call, which win over a
 * `customTags` given here, so Twoslash would refuse `@hover` as an unknown compiler flag.
 */
const hoverLine = /^\/\/\s?@hover:\s?(.*)\n?/gm;

function hoverNames(code: string): { code: string; names?: Set<string> } {
  const lines = [...code.matchAll(hoverLine)];
  if (!lines.length) return { code };
  const names = new Set(lines.flatMap((line) => line[1].split(/[\s,]+/).filter(Boolean)));
  return { code: code.replace(hoverLine, ''), names };
}

/** The lockfile of the site, which names the versions of everything a block's result depends on. */
function lockfile(site: string): string {
  for (const name of ['pnpm-lock.yaml', 'package-lock.json', 'bun.lock', 'yarn.lock']) {
    const file = path.join(site, name);
    if (existsSync(file)) return readFileSync(file, 'utf8');
  }
  return '';
}

/**
 * Fumadocs' Twoslash transformer with the site's options, a cache on disk, the `@hover` directive
 * and shorter popups.
 *
 * Each block's result is kept on disk under a hash of its code, which holds its hidden setup, so
 * `next dev` checks again only the blocks an edit changed: without it every compile checked every
 * block, and the dev server's memory grew by gigabytes per edit until it stopped (Reylo's site,
 * 2026-10-11). The directory is named for everything else a result depends on (the mounted
 * packages' source, the compiler options, the site's dependencies), so none of it can go stale.
 */
export function docsTwoslash(options: DocsTwoslashOptions = {}) {
  const twoslash = twoslashOptions(options);
  const limit = options.docsLimit ?? 400;
  const site = process.cwd();
  const key = createHash('sha256').update(JSON.stringify(twoslash)).update(lockfile(site)).digest('hex').slice(0, 12);
  const transformer = transformerTwoslash({
    twoslashOptions: twoslash,
    typesCache: createFileSystemTypesCache({ cwd: site, dir: `node_modules/.cache/docs-kit/twoslash/${key}` }),
    rendererRich: {
      processHoverInfo: (info) => {
        const text = defaultHoverInfoProcessor(info);
        return options.processHoverInfo ? options.processHoverInfo(text) : text;
      },
      // A popup is about the page's own types: Node's documentation of process.env runs to a screen.
      processHoverDocs: (docs) => (docs.length > limit ? '' : docs),
    },
  });
  // The `@hover` line (`hoverNames` above) comes out before Twoslash runs, and Twoslash's result is
  // narrowed after it is read from the cache or made, so the cache keeps every block's whole result
  // and stays correct whatever the line says. The narrowing comes before Shiki splits the tokens at
  // each node and the renderer wraps them: the transformer keeps the result it renders on
  // `this.meta.twoslash`, the same object its later hooks read.
  const preprocess = transformer.preprocess!;
  transformer.preprocess = function (source, shikiOptions) {
    const { code, names } = hoverNames(source);
    const result = preprocess.call(this, code, shikiOptions);
    const meta = this.meta.twoslash;
    if (names && meta) meta.nodes = meta.nodes.filter((node) => node.type !== 'hover' || names.has(node.target));
    return result;
  };
  return transformer;
}
