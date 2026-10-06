import { defineDocs } from 'fumadocs-mdx/macro';
import { loader } from 'fumadocs-core/source';

// One page: content/docs/index.mdx at /.
const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // Fumadocs' defaults plus Twoslash on `ts twoslash` blocks (lib/twoslash.ts), whose imports of
    // the page's data files are typed by Motherload's own mapper (lib/remark-mapper.ts), and each
    // section's Markdown on its heading (lib/remark-sections.ts). The macro runs this only at build
    // time, so the app never imports TypeScript.
    mdxOptions: async (environment) => {
      const { applyMdxPreset } = await import('fumadocs-mdx/config');
      const { rehypeCodeDefaultOptions } = await import('fumadocs-core/mdx-plugins');
      const { motherloadTwoslash } = await import('./twoslash');
      const { remarkMapper } = await import('./remark-mapper');
      const { remarkSections } = await import('./remark-sections');
      return applyMdxPreset({
        remarkPlugins: [remarkSections, remarkMapper],
        rehypeCodeOptions: {
          ...rehypeCodeDefaultOptions,
          transformers: [...(rehypeCodeDefaultOptions.transformers ?? []), motherloadTwoslash()],
          // Shiki cannot load a language lazily inside a Twoslash popup.
          langs: ['js', 'jsx', 'ts', 'tsx', 'toml', 'yaml', 'json', 'jsonc', 'json5', 'dotenv', 'sh'],
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
        },
      })(environment);
    },
  },
});

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});
