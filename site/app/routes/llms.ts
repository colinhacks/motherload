import { readFile } from 'node:fs/promises';
import { pageMarkdown } from 'docs-kit/remark-sections';
import { pageFiles } from '@/lib/page-files';
import { siteUrl } from '@/lib/site';

// The page as Markdown, for a coding agent or a language model (https://llmstxt.org), as Reylo's
// site serves its own: the page's files in order (lib/page-files.ts), read as each heading's copy
// button reads its section, under its title and description, with each link to a section of the
// page (`#…`) made absolute (docs-kit's pageMarkdown). Written to build/client/llms.txt at build
// time. It is the page's Markdown too: vercel.json answers a request for / that asks for Markdown
// (`Accept: text/markdown`, as Claude Code, Cursor and OpenCode send) with this file.
export async function loader() {
  const sources = await Promise.all(pageFiles().map((file) => readFile(file, 'utf8')));
  return new Response(pageMarkdown(sources, { site: siteUrl }), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
