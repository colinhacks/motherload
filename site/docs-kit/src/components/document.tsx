import { RootProvider } from 'fumadocs-ui/provider/react-router';
import type { ReactNode } from 'react';
import { Links, Meta, Scripts, ScrollRestoration } from 'react-router';
import { KEEP_IN_PLACE_SCRIPT, TABS_PREPAINT_SCRIPT, tabsRestoreScript } from './head-scripts';

/**
 * The document of a docs site on React Router, for the site's app/root.tsx (`export function
 * Layout({ children }) { return <DocsDocument …>{children}</DocsDocument>; }`): `<html>` with the
 * site's class; in the head, the charset and viewport, docs-kit's scripts (a stale saved tab choice
 * put right for the groups in `tabs`, every saved tab choice shown from the first paint, a pressed
 * tab kept under the pointer; ./head-scripts.ts), the route's meta tags and links, and the site's
 * own `head`; in the body, Fumadocs' provider with search off (the site is one page), React
 * Router's scroll restoration and its scripts.
 */
export function DocsDocument({
  className,
  tabs = {},
  head,
  children,
}: {
  className?: string;
  /** The page's tab groups and their values, for `tabsRestoreScript`. */
  tabs?: Record<string, readonly string[]>;
  /** The site's own elements for the head, after the route's meta and links (font preloads, icon links, a script). */
  head?: ReactNode;
  children: ReactNode;
}) {
  const scripts = [Object.keys(tabs).length > 0 ? tabsRestoreScript(tabs) : '', TABS_PREPAINT_SCRIPT, KEEP_IN_PLACE_SCRIPT].filter(Boolean).join('\n');
  return (
    <html lang="en" suppressHydrationWarning className={className}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: scripts }} />
        <Meta />
        <Links />
        {head}
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ enabled: false }}>{children}</RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
