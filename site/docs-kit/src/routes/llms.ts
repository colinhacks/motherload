// `/llms.txt`: the site as Markdown, for an agent. A site of one page serves that page; a site of
// several joins every page's, in the order of `sitePageSlugs`. Each page's own `.md` is `./markdown.ts`.
import { markdownOf, sitePageSlugs } from '../page.server';

export async function loader() {
  const text = (await Promise.all(sitePageSlugs().map((slug) => markdownOf(slug)))).join('\n');
  return new Response(text, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
