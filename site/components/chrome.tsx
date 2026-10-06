import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';

export const githubUrl = 'https://github.com/colinhacks/motherload';

/*
 * The page has no bar that stays on screen, as on nub's docs (nub/site): the name sits at the top
 * of the left column and the repository and theme switch at its foot. Here that column is the
 * table of contents, so the name is its header and the links its footer. Below xl Fumadocs hides
 * the column and shows its popover instead, so `TopRow` carries the same three things above the
 * title, in the grid's empty header row, and scrolls away with the page.
 */

/** The chest and the name, a link to the top of the page, and the status. */
function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <a href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight text-fd-headings">
        {/* public/motherload.svg, the same drawing as app/icon.svg. */}
        <img src="/motherload.svg" alt="" width={22} height={22} className="size-5.5" />
        Motherload
      </a>
      <span className="rounded-full border px-2 py-0.5 font-mono text-xs leading-none text-fd-muted-foreground">beta</span>
    </div>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  // The GitHub mark, as nub's site draws it.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

const linkClass = 'inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground';

/** Above "On this page", in the left column. */
export function TocHeader() {
  return (
    <div className="mb-10">
      <Brand />
    </div>
  );
}

/** Below the entries, in the left column: the repository, then the theme switch. */
export function TocFooter() {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
      <a href={githubUrl} rel="noreferrer noopener" target="_blank" className={linkClass}>
        <GitHubIcon className="size-3.5 shrink-0" />
        colinhacks/motherload
      </a>
      <ThemeSwitch />
    </div>
  );
}

/** Below xl, where the left column is hidden: one row above the title, not sticky. */
export function TopRow() {
  return (
    <div className="[grid-area:header] mx-auto flex w-full max-w-[900px] items-center gap-3 px-4 pt-4 md:px-6 xl:hidden">
      <Brand />
      <div className="flex-1" />
      <a href={githubUrl} rel="noreferrer noopener" target="_blank" className={linkClass} aria-label="GitHub">
        <GitHubIcon className="size-4" />
      </a>
      <ThemeSwitch />
    </div>
  );
}
