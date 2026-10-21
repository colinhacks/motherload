import type { applyMdxPreset } from 'fumadocs-mdx/config';

type Environment = Parameters<ReturnType<typeof applyMdxPreset>>[0];

/**
 * The MDX options of every page on the site: docs-kit's (each section's Markdown on its heading,
 * Twoslash with its cache and the `// @hover:` directive, the hanging indent of wrapped code, each
 * distinct popup built once), with Motherload's own: the modules Motherload's mapper returns for
 * the page's data files, put into each block that imports them (lib/remark-mapper.ts), Twoslash's
 * options (lib/twoslash.ts), the languages of the data files, and the palette.
 */
export async function mdxOptions(environment: Environment) {
  const { docsMdxOptions } = await import('docs-kit/mdx');
  const { remarkMapper } = await import('./remark-mapper.ts');
  const { motherloadTwoslash } = await import('./twoslash.ts');
  return docsMdxOptions(environment, {
    remarkPlugins: [remarkMapper],
    twoslash: motherloadTwoslash(),
    langs: ['toml', 'yaml', 'json', 'jsonc', 'json5', 'dotenv', 'sh'],
    // The page's "Lantern" palette (app/global.css): each GitHub theme colour, by role, as an
    // ash-and-amber or coal-and-amber one. Twoslash's popups render through the same options.
    colorReplacements: {
      'github-light': {
        '#d73a49': '#9a5a00', // keyword
        '#24292e': '#262421', // text
        '#032f62': '#6b5a2a', // string
        '#005cc5': '#b04a12', // constant, property
        '#6f42c1': '#5a4630', // function, type
        '#6a737d': '#6f6960', // comment
        '#e36209': '#8a5200', // variable
        '#22863a': '#6b5a2a', // tag
      },
      'github-dark': {
        '#f97583': '#f5a524',
        '#e1e4e8': '#d0ccc4',
        '#9ecbff': '#f2d39a',
        '#dbedff': '#f2d39a',
        '#79b8ff': '#ff8a4c',
        '#b392f0': '#ffcb6b',
        '#6a737d': '#898373',
        '#ffab70': '#e9b97a',
        '#85e89d': '#c9b98a',
      },
    },
  });
}
