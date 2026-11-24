// `/robots.txt`: every page may be crawled, and the sitemap is named.
import site from '@/docs.config';

export function loader() {
  return new Response(`User-Agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
