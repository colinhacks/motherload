import { defineCollections, defineConfig, defineDocs } from 'fumadocs-mdx/config';

// The page is content/docs/index.mdx, the opening and the hero, and one file per h2 section in
// content/sections/ (lib/page-files.ts), so that an edit compiles one section. The showcase
// (app/routes/showcase.tsx) and Every format (app/routes/formats.tsx) are collections of their own,
// so the docs' page tree never lists them. All
// take lib/mdx-options.ts, imported inside the options so that only the build loads it (and
// TypeScript with it).
const mdxOptions = async (environment: Parameters<typeof import('./lib/mdx-options.ts').mdxOptions>[0]) => (await import('./lib/mdx-options.ts')).mdxOptions(environment);

export const docs = defineDocs({ dir: 'content/docs', docs: { mdxOptions } });
export const sections = defineCollections({ type: 'doc', dir: 'content/sections', mdxOptions });
export const showcase = defineCollections({ type: 'doc', dir: 'content/showcase', mdxOptions });
export const formats = defineCollections({ type: 'doc', dir: 'content/formats', mdxOptions });

export default defineConfig();
