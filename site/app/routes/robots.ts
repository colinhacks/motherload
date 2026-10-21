import { siteUrl } from '@/lib/site';

// Everything allowed, and the sitemap named. Written to build/client/robots.txt.
export function loader() {
  return new Response(`User-Agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
