/** The bars and the name, a link to the top of the page, and the status: docs-kit's chrome shows it at the top of the left column, or above the title below xl. */
export function Brand() {
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

export const githubUrl = 'https://github.com/colinhacks/motherload';
