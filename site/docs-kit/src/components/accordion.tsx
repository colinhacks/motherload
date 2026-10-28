'use client';

import { Accordion as Root, AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from 'fumadocs-ui/components/ui/accordion';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { useCopyButton } from 'fumadocs-ui/utils/use-copy-button';
import { createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

/*
 * Fumadocs' `<Accordions>` and `<Accordion>`, drawn as Fumadocs draws them, with one change: a
 * closed item's content is in the HTML. Fumadocs renders it only once the item opens (Radix's
 * collapsible leaves it out until then), so the prerendered page had the headings of Motherload's
 * Setup accordions and nothing under them, which a coding agent that fetches the page, a search
 * engine and the browser's find-in-page all saw as empty.
 *
 * Every item's content is rendered (`forceMount`), and a closed one is hidden in two ways:
 * 1. Until the page hydrates, by `[data-dk-accordion-panel][data-state=closed]:not([data-dk-ready])`
 *    in style.css. React 19.2 writes any `hidden` as `hidden=""`, so the server cannot write
 *    `hidden="until-found"` itself.
 * 2. From then on, by `hidden="until-found"`, set here on the element once the item is closed and
 *    its closing animation has run, so the animation still plays. The browser's find-in-page
 *    searches such an element and, on a match, fires `beforematch` and reveals it, and so does a
 *    link to an `id` inside it; the item then opens, as if its trigger had been pressed. A browser
 *    without `until-found` treats the attribute as plain `hidden`.
 * React never writes the attribute (Radix's `hidden` is false for a content always mounted); a
 * layout effect removes it when the item opens and measures the height the animation runs to.
 */

type Value = string | string[];

const ItemsContext = createContext<{ value: Value; open: (item: string) => void } | null>(null);

const isOpen = (value: Value, item: string) => (typeof value === 'string' ? value === item : value.includes(item));

/** A list of items, any number open at once (`type="multiple"`, the default) or one at a time (`type="single"`). */
export function Accordions({
  type = 'multiple',
  defaultValue,
  ref,
  children,
  ...props
}: { type?: 'single' | 'multiple'; defaultValue?: Value; children?: ReactNode } & Omit<ComponentProps<'div'>, 'defaultValue' | 'dir'>) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Items the reader opened before the page hydrated (the head script's, ./head-scripts.ts) start
  // open, as the head script already shows them, so they neither close nor animate again.
  const [value, setValue] = useState<Value>(() => {
    const opened = typeof window === 'undefined' ? [] : [...((window as { __dkAccordionPending?: Map<string, boolean> }).__dkAccordionPending ?? [])].filter(([, isOpen]) => isOpen).map(([item]) => item);
    if (type === 'single') return opened.at(-1) ?? defaultValue ?? '';
    return [...new Set([...((defaultValue as string[] | undefined) ?? []), ...opened])];
  });
  useEffect(() => {
    (window as { __dkAccordionPending?: Map<string, boolean> }).__dkAccordionPending?.clear();
  }, []);
  const open = useCallback((item: string) => setValue((prev) => (typeof prev === 'string' ? item : prev.includes(item) ? prev : [...prev, item])), []);
  // As Fumadocs' do: an address whose fragment names an item's heading opens that item.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const selected = id ? document.getElementById(id) : null;
    const item = selected && rootRef.current?.contains(selected) ? selected.getAttribute('data-accordion-value') : null;
    if (item) open(item);
  }, [open]);
  const setRef = (element: HTMLDivElement | null) => {
    rootRef.current = element;
    if (typeof ref === 'function') ref(element);
    else if (ref) ref.current = element;
  };
  const root = type === 'single'
    ? { type, collapsible: true, value: value as string, onValueChange: (next: string) => setValue(next) }
    : { type, value: value as string[], onValueChange: (next: string[]) => setValue(next) };
  return (
    <ItemsContext value={useMemo(() => ({ value, open }), [value, open])}>
      <Root ref={setRef} {...props} className={['dk-accordions', props.className].filter(Boolean).join(' ')} {...(root as ComponentProps<typeof Root>)}>
        {children}
      </Root>
    </ItemsContext>
  );
}

/** Hides a closed item's content, still searchable by find-in-page. */
const conceal = (element: HTMLElement) => element.setAttribute('hidden', 'until-found');

/** One item: its `title` is the trigger, an `id` makes its heading a link target with a Copy Link button. */
export function Accordion({
  title,
  id,
  value = String(title),
  children,
  ...props
}: { title: ReactNode; id?: string; value?: string; children?: ReactNode } & Omit<ComponentProps<typeof AccordionItem>, 'value' | 'title'>) {
  const items = use(ItemsContext);
  const open = items ? isOpen(items.value, value) : false;
  const ref = useRef<HTMLDivElement>(null);
  const openItem = items?.open;

  // Once hydrated: the server's rule in style.css stops applying, and a found match opens the item.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.setAttribute('data-dk-ready', '');
    const onMatch = () => flushSync(() => openItem?.(value));
    element.addEventListener('beforematch', onMatch);
    return () => element.removeEventListener('beforematch', onMatch);
  }, [openItem, value]);

  // Each time the item opens or closes, after Radix's own layout effect and before the paint: the
  // content shown again if it opens, its height measured for the animation, and, if it closes with
  // no closing animation to wait for (on hydration, or with animations off), hidden at once;
  // otherwise `onAnimationEnd` hides it. Radix measures the height itself, but writes it to
  // `--radix-collapsible-content-height` only when it re-renders, which a content always mounted
  // never makes it do, so without this the opening animation ran from 0 to nothing and the content
  // appeared at its full height when it ended.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open) element.removeAttribute('hidden');
    const animation = element.style.animationName;
    element.style.animationName = 'none';
    const height = element.getBoundingClientRect().height;
    element.style.animationName = animation;
    if (height) element.style.setProperty('--radix-collapsible-content-height', `${height}px`);
    if (!open && !element.getAnimations().some((running) => running.playState === 'running')) conceal(element);
  }, [open]);

  return (
    <AccordionItem value={value} {...props}>
      <AccordionHeader id={id} data-accordion-value={value}>
        <AccordionTrigger>{title}</AccordionTrigger>
        {id ? <CopyLink id={id} /> : null}
      </AccordionHeader>
      <AccordionContent
        ref={ref}
        forceMount
        data-dk-accordion-panel=""
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && event.currentTarget.dataset.state === 'closed') conceal(event.currentTarget);
        }}
      >
        <div className="px-4 pb-2 text-[0.9375rem] prose-no-margin">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

/** Fumadocs' button that copies a link to the item, with lucide's link and check icons drawn inline. */
function CopyLink({ id }: { id: string }) {
  const [checked, onClick] = useCopyButton(() => {
    const url = new URL(window.location.href);
    url.hash = id;
    return navigator.clipboard.writeText(url.toString());
  });
  return (
    <button type="button" aria-label="Copy Link" className={buttonVariants({ color: 'ghost', className: 'text-fd-muted-foreground me-2' })} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
        {checked ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </>
        )}
      </svg>
    </button>
  );
}
