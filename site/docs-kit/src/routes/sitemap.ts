// `/sitemap.xml`: each page's address, in the order of `sitePageSlugs`, with no `lastmod`, which would be
// the time of the build rather than of the page's last change, and which Google ignores when it is
// not.
import site from '@/docs.config';
import { sitePageSlugs } from '../page.server';
import { urlOf } from '../site';

export function loader() {
  const urls = sitePageSlugs().map((slug) => `  <url><loc>${urlOf(site, slug)}</loc></url>\n`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('')}</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
