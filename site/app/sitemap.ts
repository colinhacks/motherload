import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { source } from '@/lib/source';

// The site's one page, at /, dated by the build. The showcase is not listed: nothing links to it and
// it asks not to be indexed.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return source.getPages().map((page) => ({ url: new URL(page.url, siteUrl).href, lastModified, changeFrequency: 'weekly', priority: 1 }));
}
