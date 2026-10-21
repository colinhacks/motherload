/** The bars and the name, a link to the top of the page, and the status: docs-kit's chrome shows it at the top of the left column, or above the title below xl. */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <a href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-fd-headings">
        {/* public/motherload.svg, the same drawing as public/icon.svg, 24px beside the 18px name;
            22px and 16px until the maintainer, 2026-10-21: "can we make the word mark a little bit
            bigger?" Raised 0.5px. Centred on the line box, the bars' ink hung 2.25px below the baseline. Raised 1.5px, which matched the
            ink's centre of mass to the word's within 0.12px, the bars still looked high to the
            maintainer, 2026-10-20: "move the Motherload icon down by a pixel relative to the
            Motherload label. It still doesn't look vertically centered." A transform, because
            Chrome rounds a layout offset (`top`) to whole pixels. */}
        <img src="/motherload.svg" alt="" width={24} height={24} className="size-6 -translate-y-[0.5px]" />
        Motherload
      </a>
      <span className="rounded-full border px-2 py-0.5 font-mono text-xs leading-none text-fd-muted-foreground">beta</span>
    </div>
  );
}
