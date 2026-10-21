import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

// The site's one page, content/docs/index.mdx at /, which goes on in content/sections/, a file per h2
// section (lib/page-files.ts). Read at build time only, by the routes' loaders; the browser loads the
// page's files itself (lib/content.ts). The showcase (app/routes/showcase.tsx) is a collection of its
// own, so the page tree never lists it.
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});
