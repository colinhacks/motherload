/** The bars and the name, a link to the top of the page, and the status: docs-kit's chrome shows it at the top of the left column, or above the title below xl. */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <a href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight text-fd-headings">
        {/* public/motherload.svg, the same drawing as app/icon.svg. Raised 1.5px: centred on the
            line box, the bars' ink hung 2.25px below the baseline, and the stack, two bars under
            one, carries its weight low, so its ink's centre of mass sat 1.56px (dark) and 1.62px
            (light) below the word's; raised, they agree within 0.12px (measured at 4x on
            2026-10-20, after the maintainer found the two "not perfectly vertically aligned"). A
            transform, because Chrome rounds a layout offset (`top`) to whole pixels: 1.5px moved
            it by 1. */}
        <img src="/motherload.svg" alt="" width={22} height={22} className="size-5.5 -translate-y-[1.5px]" />
        Motherload
      </a>
      <span className="rounded-full border px-2 py-0.5 font-mono text-xs leading-none text-fd-muted-foreground">beta</span>
    </div>
  );
}

export const githubUrl = 'https://github.com/colinhacks/motherload';
