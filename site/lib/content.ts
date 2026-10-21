import browserCollections from 'collections/browser';
import type { CompiledMDXProperties } from 'fumadocs-mdx';

/** One file of a page as the browser loads it: its content (`default`) and its table of contents. */
export type PageFile = Pick<CompiledMDXProperties, 'default' | 'toc'>;

const sections = Object.entries(browserCollections.sections.raw)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, load]) => load);
const loaded = new Map<string, Promise<PageFile[]>>();

/**
 * A page's files, in the order it shows them (lib/page-files.ts): the page's own file, and after
 * the main page's (index.mdx) each section of content/sections/. Every file is a module of its own,
 * fetched in parallel and once, apart from the showcase's. The route renders them with `use()`:
 * while they load during hydration, React keeps the prerendered page.
 */
export function loadPage(path: string): Promise<PageFile[]> {
  let files = loaded.get(path);
  if (!files) {
    const own = browserCollections.docs.raw[`./${path}`];
    if (!own) throw new Error(`content/docs/${path} is not a page`);
    files = Promise.all<PageFile>([own(), ...(path === 'index.mdx' ? sections.map((load) => load()) : [])]);
    loaded.set(path, files);
  }
  return files;
}
