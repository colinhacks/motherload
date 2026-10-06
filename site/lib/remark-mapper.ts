import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Twoslash runs TypeScript's JavaScript API (6.0, from fumadocs-twoslash), which cannot run a
// content mapper. So each `ts twoslash` block that imports a file shown on the page (a code block
// titled `config.toml`) gets, as hidden files, the modules Motherload's mapper returns for those
// files: `config.d.toml.ts`, which `./config.toml` resolves to under allowArbitraryExtensions.
// Every hover on the page is the mapper's real output for the file printed above it.

type Node = { type: string; lang?: string | null; meta?: string | null; value?: string; data?: { tab?: string }; children?: Node[] };
type Code = Node & { value: string };

function codeBlocks(node: Node, out: Code[] = []): Code[] {
  if (node.type === 'code') out.push(node as Code);
  for (const child of node.children ?? []) codeBlocks(child, out);
  return out;
}

/** The file TypeScript looks up for `./name.ext` under allowArbitraryExtensions. */
function declarationName(file: string): string {
  const dot = file.lastIndexOf('.');
  return `${file.slice(0, dot)}.d${file.slice(dot)}.ts`;
}

/** A block's file name: its `title`, or its `tab` in a group of code tabs (Fumadocs' remarkCodeTab moves `tab` into `data`). */
const titleOf = (node: Code) => /title="([^"]+)"/.exec(node.meta ?? '')?.[1] ?? node.data?.tab;

// The files Motherload reads, as in src/formats.ts.
const DATA = /(\.schema\.json|\.toml|\.ya?ml|\.json5|\.jsonc|\.csv|\.tsv|\.txt|\.md|(?:^|\/)\.env(?:\.[^/]+)?|\.env)$/;

// `import config from "./config.toml"` and a bare `import "./.env"`.
const IMPORT = /\b(?:from|import)\s+["']\.\/([^"']+)["']/g;

export function remarkMapper() {
  // The build runs in site/. A schema's optional peers (ajv, json-schema-to-typescript) resolve
  // from there, through the repository's node_modules.
  const site = process.cwd();
  return (tree: Node) => {
    // Each import is typed from the nearest block above it with the file's name, so a page can show
    // a file twice, such as a working config.toml and then a broken one; failing that, from the
    // first one below it, as in a group of tabs whose first tab is main.ts.
    const blocks = codeBlocks(tree);
    const fileAt = (name: string, index: number) => {
      const isFile = (node: Code) => titleOf(node) === name;
      const before = blocks.slice(0, index).findLast(isFile);
      return (before ?? blocks.slice(index + 1).find(isFile))?.value;
    };
    const typed: { node: Code; imports: { name: string; text: string }[] }[] = [];
    blocks.forEach((node, index) => {
      if (node.lang !== 'ts' || !node.meta?.includes('twoslash')) return;
      const imports = [...new Set([...node.value.matchAll(IMPORT)].map((m) => m[1]!))]
        .filter((name) => DATA.test(name))
        .flatMap((name) => {
          const text = fileAt(name, index);
          return text === undefined ? [] : [{ name, text }];
        });
      if (imports.length) typed.push({ node, imports });
    });
    if (!typed.length) return;

    const key = (file: { name: string; text: string }) => `${file.name}\0${file.text}`;
    const files = [...new Map(typed.flatMap((b) => b.imports).map((file) => [key(file), file])).values()];
    const output = execFileSync(process.execPath, [path.join(site, 'scripts/mapper-types.ts')], {
      input: JSON.stringify(files.map((file) => ({ path: path.join(site, file.name), text: file.text }))),
      encoding: 'utf8',
    });
    const results = JSON.parse(output) as { types: string; problems: { message: string }[] }[];
    const modules = new Map(files.map((file, i) => [key(file), results[i]!]));
    files.forEach((file, i) => {
      const { problems } = results[i]!;
      if (problems.length) throw new Error(`motherload: ${file.name}: ${problems.map((p) => p.message).join('; ')}`);
    });

    for (const { node, imports } of typed) {
      const hidden = imports.map((file) => `// @filename: ${declarationName(file.name)}\n${modules.get(key(file))!.types}`).join('');
      // The block's own code follows the hidden files as a file of its own, cut above its first line
      // unless the block places the cut itself.
      const own = node.value.includes('---cut---') ? node.value : `// ---cut---\n${node.value}`;
      const visible = node.value.includes('@filename') ? node.value : `// @filename: ${titleOf(node) ?? 'main.ts'}\n${own}`;
      node.value = hidden + visible;
    }
  };
}
