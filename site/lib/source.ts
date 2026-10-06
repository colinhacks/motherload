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
        },
      })(environment);
    },
  },
});

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});
