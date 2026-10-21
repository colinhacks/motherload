import { readFile } from 'node:fs/promises';
import { toAgentMarkdown } from 'docs-kit/remark-sections';
import { pageFiles } from '@/lib/page-files';
import { siteUrl } from '@/lib/site';

// The page as Markdown, for a coding agent or a language model (https://llmstxt.org), as Reylo's
// site serves its own: the page's files in order (lib/page-files.ts), read as each heading's copy
// button reads its section (docs-kit's remark-sections), under its title and description, with each
// link to a section of the page (`#…`) made absolute. Written to build/client/llms.txt at build time.
const split = (text: string) => text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];

export async function loader() {
  const [first, ...rest] = await Promise.all(pageFiles().map((file) => readFile(file, 'utf8')));
  const [, frontmatter = '', intro = first!] = split(first!);
  const field = (name: string) => frontmatter.match(new RegExp(`^${name}: (.*)$`, 'm'))?.[1] ?? '';
  const body = [intro, ...rest.map((text) => split(text)[2] ?? text)].join('\n');
  const text = toAgentMarkdown(body).replaceAll('](#', `](${siteUrl}/#`).replaceAll('](/', `](${siteUrl}/`);
  return new Response(`# ${field('title')}\n\n> ${field('description')}\n\n${text.trim()}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
