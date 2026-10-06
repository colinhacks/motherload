'use client';

import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';

export const githubUrl = 'https://github.com/colinhacks/motherload';

/**
 * The one bar above the page: the pickaxe and the name, the status, the repository and the theme
 * switch. Fumadocs' own docs header shows only on small screens, where it opens the sidebar tree;
 * this page has no tree, so the bar is the same at every width, full width, in the place of a banner.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-(--fd-banner-height) items-center gap-4 border-b bg-fd-background/85 px-4 backdrop-blur-sm md:px-6 xl:px-8">
      <a href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight text-fd-headings">
        <span aria-hidden className="font-[Apple_Color_Emoji,Segoe_UI_Emoji,Noto_Color_Emoji,sans-serif] text-lg leading-none">⛏️</span>
        Motherload
      </a>
      <span className="rounded-full border px-2 py-0.5 font-mono text-xs text-fd-muted-foreground">pre-alpha · not published</span>
      <div className="flex-1" />
      <a href={githubUrl} rel="noreferrer noopener" target="_blank" className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground">
        GitHub
      </a>
      <ThemeSwitch />
    </header>
  );
}
