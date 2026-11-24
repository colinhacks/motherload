import { CopyAgentPrompt } from 'docs-kit/components';
import { DocsPage, pageMeta } from 'docs-kit/page';
import { pageLoader } from 'docs-kit/page.server';
import type { Route } from './+types/page';
import { Brand } from '@/components/brand';
import { getMDXComponents } from '@/components/mdx';

/**
 * The h2s whose h3s stay out of the table of contents: Setup's. The whole table fits one screen (a
 * window 900px tall, at Fumadocs' spacing), as on Reylo's site; with Setup's five h3s it ran 37px
 * over. Loaders keeps its h3s, one chip per extension. The headings stay on the page, with their
 * anchors.
 */
const FOLD = ['#setup'];

/** Run at build time only, when the page is rendered to a file (react-router.config.ts). */
export async function loader(args: Route.LoaderArgs) {
  return pageLoader(args);
}

export function meta(args: Route.MetaArgs): Route.MetaDescriptors {
  return pageMeta(args);
}

/**
 * Docs Kit's page: content/docs/index.mdx and then each section of content/sections/. "Copy agent
 * prompt" at the right end of the title's row copies the agent card at the top of Setup, as on Reylo's
 * page (the maintainer, 2026-10-20: "a copyable agent prompt for Motherload, the same way that we do
 * for Reylo. Make it visible, very visible at the top of the page").
 */
export default function Page({ loaderData }: Route.ComponentProps) {
  return <DocsPage data={loaderData} brand={<Brand />} components={getMDXComponents()} fold={FOLD} titleAside={<CopyAgentPrompt />} />;
}
