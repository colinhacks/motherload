import { ogAlt, ogSize } from './og.ts';
import { siteTitle, siteUrl } from './site.ts';

/**
 * The site's meta tags, as Reylo's site gives them: the title, the page's description, the
 * canonical address, robots directives that allow large image previews, and the Open Graph and X
 * card tags, whose image is app/routes/opengraph-image.tsx, its URL carrying `og`, a hash of that
 * file. The showcase (app/routes/showcase.tsx) sets its own title and asks not to be indexed.
 */
export function siteMeta(description: string, og: string, { title = siteTitle, index = true } = {}) {
  const image = `${siteUrl}/opengraph-image.png?${og}`;
  return [
    { title },
    { name: 'description', content: description },
    { name: 'application-name', content: 'Motherload' },
    { name: 'author', content: 'Colin McDonnell' },
    { name: 'creator', content: 'Colin McDonnell' },
    ...(index ? [{ name: 'robots', content: 'index, follow' }, { name: 'googlebot', content: 'index, follow, max-image-preview:large, max-snippet:-1' }] : [{ name: 'robots', content: 'noindex, nofollow' }]),
    { tagName: 'link', rel: 'canonical', href: siteUrl },
    { tagName: 'link', rel: 'alternate', type: 'text/markdown', href: `${siteUrl}/llms.txt` },
    { property: 'og:title', content: siteTitle },
    { property: 'og:description', content: description },
    { property: 'og:url', content: siteUrl },
    { property: 'og:site_name', content: 'Motherload' },
    { property: 'og:locale', content: 'en_US' },
    { property: 'og:image', content: image },
    { property: 'og:image:type', content: 'image/png' },
    { property: 'og:image:width', content: String(ogSize.width) },
    { property: 'og:image:height', content: String(ogSize.height) },
    { property: 'og:image:alt', content: ogAlt },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:creator', content: '@colinhacks' },
    { name: 'twitter:title', content: siteTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:image:alt', content: ogAlt },
    { name: 'twitter:image:type', content: 'image/png' },
    { name: 'twitter:image:width', content: String(ogSize.width) },
    { name: 'twitter:image:height', content: String(ogSize.height) },
  ];
}
