import { siteUrl } from '@/lib/site';
import { source } from '@/lib/source';

// The site's one page, at /, dated by the build. The showcase is not listed: nothing links to it and
// it asks not to be indexed. Written to build/client/sitemap.xml.
export function loader() {
  const lastmod = new Date().toISOString();
  const urls = source.getPages().map((page) => `<url>
<loc>${new URL(page.url, siteUrl).href}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>weekly</changefreq>
<priority>1</priority>
</url>
`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
