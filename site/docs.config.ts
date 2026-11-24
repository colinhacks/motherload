import { defineSite } from 'docs-kit/site';
import { ogAlt } from './lib/og.ts';

// What Motherload's docs are, for Docs Kit's routes, meta tags and structured data
// (docs-kit/README.md, "A site's config"). motherload.dev is the address www.motherload.dev
// redirects to. The title is the name and what it does, under 60 characters so that Google does not
// cut it, as Reylo's reads; the page's h1 stays the name alone.
export default defineSite({
  name: 'Motherload',
  url: 'https://motherload.dev',
  repo: 'https://github.com/colinhacks/motherload',
  title: 'Motherload — Import data files into TypeScript, fully typed',
  description: 'Import data files into TypeScript as typed modules.',
  author: { name: 'Colin McDonnell', url: 'https://github.com/colinhacks' },
  x: { creator: '@colinhacks' },
  footer: 'Released under the MIT License. Copyright © 2026 Colin McDonnell.',
  color: '#0D0E10',
  ogAlt,
  software: { language: 'TypeScript', platform: 'Node.js', license: 'https://opensource.org/licenses/MIT' },
});
