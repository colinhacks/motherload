import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import { KEEP_IN_PLACE_SCRIPT, TABS_PREPAINT_SCRIPT, tabsRestoreScript } from './head-scripts';

export { tabsRestoreScript } from './head-scripts';

/**
 * The document: `<html>` with the site's font variables as its class (`--font-text`, `--font-code`
 * and `--font-hand`, from `next/font`, which only the app can call); in the head, the scripts that
 * put a stale saved tab choice right (for the groups in `tabs`), show every saved tab choice from the
 * first paint, and keep a pressed tab under the pointer (./head-scripts.ts); and Fumadocs' provider
 * with search off (the site is one page).
 */
export function DocsRoot({
  className,
  tabs = {},
  head,
  children,
}: {
  className?: string;
  /** The page's tab groups and their values, for `tabsRestoreScript`. */
  tabs?: Record<string, readonly string[]>;
  /** The site's own elements for the head, after docs-kit's script (icon links, a script of its own). */
  head?: ReactNode;
  children: ReactNode;
}) {
  const scripts = [Object.keys(tabs).length > 0 ? tabsRestoreScript(tabs) : '', TABS_PREPAINT_SCRIPT, KEEP_IN_PLACE_SCRIPT].filter(Boolean).join('\n');
  return (
    <html lang="en" suppressHydrationWarning className={className}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scripts }} />
        {head}
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ enabled: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
