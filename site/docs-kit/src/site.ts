// What a docs site is, written once in the site's `docs.config.ts` and read by Docs Kit's routes, by
// each page's meta tags and by its structured data (README, "The config"). Docs Kit's modules
// import the config as `@/docs.config`: `@/` is the site's root in every site's Vite config and
// tsconfig, as `collections/` is fumadocs-mdx's generated `.source/`. The browser loads it too (a
// page's meta tags are made again there), so it imports nothing that only runs in Node.

/** A docs site. */
export type Site = {
  /** The product's name: the manifest's, `og:site_name`, `application-name` and the structured data's. */
  name: string;
  /** The docs' address, with the path they are served under and no trailing slash: `https://pullfrog.com/docs`. */
  url: string;
  /** The repository's URL. */
  repo: string;
  /** The first page's `<title>`: the name and what it does, under 60 characters so that a search result shows it whole. */
  title: string;
  /** Every other page's `<title>`, made from its own; `<title> — <name>` when the site gives none. */
  pageTitle?: (title: string) => string;
  /** The site's pages in reading order, by slug (`''` for the first): `/llms.txt`, the sitemap and the prerendered paths follow it. Every page in `content/docs`, the first page first, when the site gives none. */
  pages?: readonly string[];
  /** One line on what the product does, for the web app manifest. */
  description?: string;
  /** The person behind the product: the `author` and `creator` meta tags and the structured data's author. */
  author?: { name: string; url: string };
  /** X accounts as `@name`: the author's (`twitter:creator`) and the product's (`twitter:site`). */
  x?: { creator?: string; site?: string };
  /** The line at the foot of the page's column: the licence and the copyright. */
  footer?: string;
  /** The web app manifest's background and theme colour. */
  color?: string;
  /** The link preview's alternative text. With it, the meta tags give the image's type and size too (a PNG, 1200 by 630). */
  ogAlt?: string;
  /** The project as source code, for the first page's structured data (schema.org's SoftwareSourceCode); none for a product that is not a library. */
  software?: { language: string; platform: string; license: string };
};

/** A site's config, checked: `export default defineSite({ … })` in `docs.config.ts`. */
export function defineSite(site: Site): Site {
  return site;
}

/** A page's `<title>`: the site's own for the first page. */
export function titleOf(site: Site, slug: string, title: string): string {
  if (!slug) return site.title;
  return site.pageTitle ? site.pageTitle(title) : `${title} — ${site.name}`;
}

/** A page's address: the site's own for the first page. */
export function urlOf(site: Site, slug: string): string {
  return slug ? `${site.url}/${slug}` : site.url;
}

/**
 * A page's meta tags: its title and description, the page's own address as its canonical link and
 * the address of its Markdown, the link preview for Open Graph and X, and whether a search engine
 * may index it. A page `index: false` keeps out of search results (Motherload's showcase). With no
 * image, X shows the page as a small card.
 */
export function siteMeta(
  site: Site,
  { title, description, url, markdown, image, type = 'website', index = true }: { title: string; description: string; url: string; markdown: string; image?: string; type?: 'website' | 'article'; index?: boolean },
) {
  const size = image && site.ogAlt
    ? [
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: site.ogAlt },
      ]
    : [];
  return [
    { title },
    { name: 'description', content: description },
    { name: 'application-name', content: site.name },
    ...(site.author ? [{ name: 'author', content: site.author.name }, { name: 'creator', content: site.author.name }] : []),
    ...(index ? [{ name: 'robots', content: 'index, follow' }, { name: 'googlebot', content: 'index, follow, max-image-preview:large, max-snippet:-1' }] : [{ name: 'robots', content: 'noindex, nofollow' }]),
    { tagName: 'link', rel: 'canonical', href: url },
    { tagName: 'link', rel: 'alternate', type: 'text/markdown', href: markdown },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:site_name', content: site.name },
    { property: 'og:locale', content: 'en_US' },
    ...(image ? [{ property: 'og:image', content: image }, ...size] : []),
    { property: 'og:type', content: type },
    { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
    ...(site.x?.site ? [{ name: 'twitter:site', content: site.x.site }] : []),
    ...(site.x?.creator ? [{ name: 'twitter:creator', content: site.x.creator }] : []),
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...(image ? [{ name: 'twitter:image', content: image }] : []),
    ...(image && site.ogAlt
      ? [
          { name: 'twitter:image:alt', content: site.ogAlt },
          { name: 'twitter:image:type', content: 'image/png' },
          { name: 'twitter:image:width', content: '1200' },
          { name: 'twitter:image:height', content: '630' },
        ]
      : []),
  ];
}

/**
 * The site and the project as schema.org data, for the first page: the WebSite gives search results
 * the site's name, and the SoftwareSourceCode says what the page is about and where its code lives.
 * `<` is escaped so that no string in the data can close the script element.
 */
export function structuredData(site: Site, description: string): string | undefined {
  if (!site.software) return undefined;
  const { url, name } = site;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${url}/#website`, url: `${url}/`, name, description, inLanguage: 'en' },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${url}/#software`,
        name,
        description,
        url: `${url}/`,
        codeRepository: site.repo,
        programmingLanguage: site.software.language,
        runtimePlatform: site.software.platform,
        license: site.software.license,
        ...(site.author ? { author: { '@type': 'Person', name: site.author.name, url: site.author.url } } : {}),
        isPartOf: { '@id': `${url}/#website` },
      },
    ],
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
