import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { siteUrl } from '@/lib/site';
import { toAgentMarkdown } from 'docs-kit/remark-sections';

// The page as Markdown, for a coding agent or a language model (https://llmstxt.org), as Reylo's
// site serves its own: the page's source, read as each heading's copy button reads its section
// (docs-kit's remark-sections), under its title and description, with each link to a section of the
// page (`#…`) made absolute. Built once, with the page.
export const dynamic = 'force-static';

export async function GET() {
  const source = await readFile(join(process.cwd(), 'content/docs/index.mdx'), 'utf8');
  const [, frontmatter = '', body = source] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  const field = (name: string) => frontmatter.match(new RegExp(`^${name}: (.*)$`, 'm'))?.[1] ?? '';
  const text = toAgentMarkdown(body).replaceAll('](#', `](${siteUrl}/#`).replaceAll('](/', `](${siteUrl}/`);
  return new Response(`# ${field('title')}\n\n> ${field('description')}\n\n${text.trim()}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
