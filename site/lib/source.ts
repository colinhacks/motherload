import { defineCollections, defineDocs } from 'fumadocs-mdx/macro';
import { loader } from 'fumadocs-core/source';

// Both collections take their MDX options from lib/mdx-options.ts. Each imports it inside its own
// options, which the macro removes from the app, so the app never bundles it.

// One page: content/docs/index.mdx at /.
const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    mdxOptions: async (environment) => (await import('./mdx-options')).mdxOptions(environment),
  },
});

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});

// The showcase (app/showcase/page.tsx): an unlisted page of the hero's imports, one split block
// each, for screenshots. It is a collection of its own, so the docs' page tree never lists it.
export const showcase = defineCollections({
  type: 'doc',
  dir: 'content/showcase',
  mdxOptions: async (environment) => (await import('./mdx-options')).mdxOptions(environment),
});
