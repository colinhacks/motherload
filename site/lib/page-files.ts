import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * The page's files, in the order it shows them: content/docs/index.mdx, which holds the title,
 * the opening and the hero, then one file per h2 section, content/sections/*.mdx, by name. A
 * section is a file of its own so that an edit compiles that section alone.
 */
export function pageFiles(site = process.cwd()): string[] {
  const sections = path.join(site, 'content', 'sections');
  const names = existsSync(sections) ? readdirSync(sections).filter((name) => name.endsWith('.mdx')).sort() : [];
  return [path.join(site, 'content', 'docs', 'index.mdx'), ...names.map((name) => path.join(sections, name))];
}
