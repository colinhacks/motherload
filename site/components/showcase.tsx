'use client';

import { CodeBlockTab, CodeBlockTabs, CodeBlockTabsList, CodeBlockTabsTrigger } from 'fumadocs-ui/components/codeblock';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import * as Twoslash from 'fumadocs-twoslash/ui';
import {
  Children,
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  use,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';

/*
 * The client half of the showcase page (app/routes/showcase.tsx): the bar above the frames; the
 * frames, each example as a split block and as code tabs, whose blocks resize from their edges and
 * whose split panes divide where the divider is dragged; and Twoslash's hover popups made to stay
 * open when their name is clicked, so a type can be screenshotted without holding the pointer still.
 */

const FRAMES = ['16:9', '4:3', '1:1', 'fit'] as const;
type Frame = (typeof FRAMES)[number];

/** A value kept in localStorage, read after hydration so the server's markup still matches. */
function useStored<T>(key: string, initial: T, parse: (stored: string) => T | undefined) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const stored = localStorage.getItem(key);
    const parsed = stored === null ? undefined : parse(stored);
    if (parsed !== undefined) setValue(parsed);
    // `parse` is a fresh function each render; the key alone decides what is read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = (next: T) => {
    setValue(next);
    localStorage.setItem(key, typeof next === 'string' ? next : JSON.stringify(next));
  };
  return [value, update] as const;
}

const oneOf =
  <T extends string>(valid: readonly T[]) =>
  (stored: string) =>
    (valid as readonly string[]).includes(stored) ? (stored as T) : undefined;

const MAX_PADDING = 96;

/** The page: a bar of settings, then the frames, which take the frame shape, padding and logo. */
export function ShowcaseRoot({ children }: { children: ReactNode }) {
  const [frame, setFrame] = useStored<Frame>('motherload-showcase-frame', '16:9', oneOf(FRAMES));
  const [logo, setLogo] = useStored<'on' | 'off'>('motherload-showcase-logo', 'off', oneOf(['on', 'off']));
  const [padding, setPadding] = useStored('motherload-showcase-padding', 40, (stored) => {
    const value = Number(stored);
    return Number.isInteger(value) && value >= 0 && value <= MAX_PADDING ? value : undefined;
  });
  return (
    <main className="ml-showcase" data-frame={frame} data-logo={logo} style={{ '--shot-pad': `${padding}px` } as CSSProperties}>
      <div className="ml-showcase-bar">
        <span className="ml-showcase-hint">
          Hover a name for its type; click it to keep the popup open. Drag a block&apos;s right or bottom edge to resize it, and the line between its panes to move it; the pointer turns to an arrow over each.
        </span>
        <div className="ml-showcase-controls">
          <div className="ml-segmented" role="group" aria-label="Frame">
            {FRAMES.map((option) => (
              <button key={option} type="button" aria-pressed={frame === option} onClick={() => setFrame(option)}>
                {option === 'fit' ? 'Fit' : option}
              </button>
            ))}
          </div>
          <label className="ml-padding">
            <span>Padding</span>
            <input type="range" min={0} max={MAX_PADDING} step={4} value={padding} onChange={(event) => setPadding(Number(event.target.value))} />
            <output>{padding}</output>
          </label>
          <div className="ml-segmented" role="group" aria-label="Logo">
            <button type="button" aria-pressed={logo === 'on'} onClick={() => setLogo(logo === 'on' ? 'off' : 'on')}>
              Logo
            </button>
          </div>
          <ThemeSwitch />
        </div>
      </div>
      {children}
    </main>
  );
}

/** A block's size and where its divider sits, in CSS px; unset, each is the stylesheet's. */
type Layout = { width?: number; height?: number; left?: number };
type Grip = 'divider' | 'right' | 'bottom' | 'corner';

const parseLayout = (stored: string): Layout | undefined => {
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== 'object' || value === null) return undefined;
    const { width, height, left } = value as Record<string, unknown>;
    const size = (n: unknown) => (typeof n === 'number' && n > 0 ? n : undefined);
    return { width: size(width), height: size(height), left: size(left) };
  } catch {
    return undefined;
  }
};

/**
 * How wide an element must be to show its longest line and its whole file name or tab labels
 * without scrolling or truncating. Only what is laid out counts, so a hidden tab adds nothing.
 */
function contentWidth(element: HTMLElement): number {
  const left = element.getBoundingClientRect().left;
  const range = document.createRange();
  let right = 0;
  const reach = (node: Element, padded: Element) => {
    range.selectNodeContents(node);
    const { right: end, width } = range.getBoundingClientRect();
    if (width > 0) right = Math.max(right, end + (parseFloat(getComputedStyle(padded).paddingRight) || 0));
  };
  for (const line of element.querySelectorAll('[role=region] .line')) reach(line, line);
  // A name is truncated rather than scrolled, and its element stretches across the header, so its
  // text is measured instead; so are the tabs, which scroll.
  for (const caption of element.querySelectorAll('figcaption')) reach(caption, caption.parentElement!);
  for (const list of element.querySelectorAll('[role=tablist]')) reach(list, list);
  // Text measures to fractions of a pixel; the region rounds its width the other way.
  return Math.ceil(right - left) + 2;
}

/** A block's height when nothing sets it: its code's. */
function naturalHeight(block: HTMLElement): number {
  const set = block.style.minHeight;
  block.style.minHeight = '';
  const height = block.getBoundingClientRect().height;
  block.style.minHeight = set;
  return height;
}

/**
 * The click that ends a drag lands outside a pinned popup, which Base UI takes as a press outside
 * it and closes the popup. A drag swallows that one click, before the document sees it.
 */
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}

/**
 * The rendered code blocks among an element's children. The compiled MDX wraps each block in a
 * fragment, which a server component passed to this client one flattened when the site ran on
 * Next.js; here they are unwrapped.
 */
const blocks = (children: ReactNode): ReactNode[] =>
  Children.toArray(children).flatMap((child) => (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment ? blocks(child.props.children) : [child]));

/** A rendered code block's file name, from rehype-code's `title`. */
const titleOf = (pane: ReactElement) => String((pane.props as { title?: unknown }).title ?? '');

/**
 * One example, twice: as a split block, main.ts beside the file it imports, and as code tabs, as
 * the docs page's hero shows its files. Both are drawn from the same two rendered panes.
 */
export function Shot({ file, children }: { file: string; children: ReactNode }) {
  const panes = blocks(children).filter(isValidElement);
  return (
    <>
      <Frame storage={`motherload-showcase-layout:${file}`} label={`${file} · split`} kind="split">
        {panes}
      </Frame>
      <Frame storage={`motherload-showcase-layout:tabs:${file}`} label={`${file} · tabs`} kind="tabs">
        <CodeBlockTabs defaultValue={titleOf(panes[0]!)}>
          <CodeBlockTabsList>
            {panes.map((pane) => (
              <CodeBlockTabsTrigger key={titleOf(pane)} value={titleOf(pane)}>
                {titleOf(pane)}
              </CodeBlockTabsTrigger>
            ))}
          </CodeBlockTabsList>
          {panes.map((pane) => (
            <CodeBlockTab key={titleOf(pane)} value={titleOf(pane)}>
              {/* The tab names the file, so the pane drops its own header. */}
              {cloneElement(pane as ReactElement<{ title?: string }>, { title: undefined })}
            </CodeBlockTab>
          ))}
        </CodeBlockTabs>
      </Frame>
    </>
  );
}

/**
 * One screenshot: a frame around a block, which resizes from its right edge, its bottom edge or
 * its corner. A split block's divider moves too. No pane goes narrower than its longest line, nor
 * the block shorter than its code. Each frame keeps its layout in localStorage.
 */
function Frame({ storage, label, kind, children }: { storage: string; label: string; kind: 'split' | 'tabs'; children: ReactNode }) {
  const [layout, setLayout] = useStored<Layout>(storage, {}, parseLayout);
  const block = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.borderBoxSize[0]!;
      setSize({ width: Math.round(box.inlineSize), height: Math.round(box.blockSize) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const drag = (grip: Grip) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = block.current;
    if (event.button !== 0 || !element) return;
    // A split block's panes; code tabs have none, and are measured whole.
    const [left, right] = kind === 'split' ? [...element.querySelectorAll<HTMLElement>(':scope > figure')] : [];
    if (kind === 'split' && (!left || !right)) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const frameElement = frame.current!;
    const box = element.getBoundingClientRect();
    // Where on the handle the pointer took hold, so the edge keeps that distance from it.
    const grab = { x: event.clientX - box.right, y: event.clientY - box.bottom, divider: left ? event.clientX - left.getBoundingClientRect().right : 0 };
    const minLeft = left ? contentWidth(left) : 0;
    const minRight = right ? contentWidth(right) : 0;
    const minWidth = kind === 'tabs' ? contentWidth(element) : 0;
    const minHeight = naturalHeight(element);
    let next: Layout = { ...layout, width: box.width, ...(left ? { left: left.getBoundingClientRect().width } : {}) };

    // While the pointer moves, the block's style is written directly, and each move measures where
    // the edge now is. The block is centred across its frame and the frame across the page, so its
    // right edge moves half as far as its width changes. It is centred down the frame too while
    // the frame's shape leaves room above and below it, and then its bottom edge also moves half as
    // far; once the block sets the frame's height, its top stays put and the edge moves as far.
    const apply = (layout: Layout) => {
      element.style.width = `${layout.width}px`;
      if (layout.height !== undefined) element.style.minHeight = `${layout.height}px`;
      if (layout.left !== undefined) element.style.gridTemplateColumns = `${layout.left}px minmax(0, 1fr)`;
    };
    const move = (moved: PointerEvent) => {
      const now = element.getBoundingClientRect();
      const pane = left?.getBoundingClientRect();
      next = { ...next };
      if (grip === 'divider' && pane) {
        const wanted = pane.width + (moved.clientX - grab.divider - pane.right);
        next.left = Math.round(Math.min(Math.max(wanted, minLeft), now.width - minRight));
      }
      if (grip === 'right' || grip === 'corner') {
        const wanted = now.width + 2 * (moved.clientX - grab.x - now.right);
        next.width = Math.round(Math.max(wanted, pane ? pane.width + minRight : minWidth));
      }
      if (grip === 'bottom' || grip === 'corner') {
        const style = getComputedStyle(frameElement);
        const room = frameElement.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - now.height;
        const travel = room > 0.5 ? 2 : 1;
        const wanted = now.height + travel * (moved.clientY - grab.y - now.bottom);
        next.height = Math.round(Math.max(wanted, minHeight));
      }
      apply(next);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      delete handle.dataset.active;
      setLayout(next);
      swallowNextClick();
    };
    handle.setPointerCapture(event.pointerId);
    handle.dataset.active = '';
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  // The height is a minimum: a taller tab, or a pane's code, still fits.
  const style: CSSProperties = {
    width: layout.width,
    minHeight: layout.height,
    gridTemplateColumns: layout.left === undefined ? undefined : `${layout.left}px minmax(0, 1fr)`,
  };

  return (
    <div className="ml-shot-wrap">
      <div className="ml-shot-meta">
        <span>{label}</span>
        <span>{size ? `${size.width} × ${size.height}` : ''}</span>
        <button type="button" onClick={() => setLayout({})} disabled={!layout.width && !layout.height && !layout.left}>
          Reset
        </button>
      </div>
      <section ref={frame} className="ml-shot">
        <div ref={block} className={`ml-block ml-${kind}`} style={style}>
          {children}
          {kind === 'split' && <div className="ml-grip" data-grip="divider" onPointerDown={drag('divider')} />}
          <div className="ml-grip" data-grip="right" onPointerDown={drag('right')} />
          <div className="ml-grip" data-grip="bottom" onPointerDown={drag('bottom')} />
          <div className="ml-grip" data-grip="corner" onPointerDown={drag('corner')} />
        </div>
        <div className="ml-shot-logo" aria-hidden>
          {/* public/motherload.svg, the same drawing as public/icon.svg. */}
          <img src="/motherload.svg" alt="" width={20} height={20} />
          Motherload
        </div>
      </section>
    </div>
  );
}

type PinState = { pinned: boolean; setPinned: (pinned: boolean) => void; trigger: RefObject<HTMLButtonElement | null> };

const Pin = createContext<PinState | null>(null);

function usePin() {
  const pin = use(Pin);
  if (!pin) throw new Error('A showcase popup part is outside its Popup');
  return pin;
}

/** Twoslash's Popup, with a pinned state its trigger and content share. */
export function Popup(props: ComponentProps<typeof Twoslash.Popup>) {
  const [pinned, setPinned] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Pin value={{ pinned, setPinned, trigger }}>
      <Twoslash.Popup {...props} />
    </Pin>
  );
}

// Twoslash closes a popup when the pointer leaves its name or its card. Its parts spread their
// props after those handlers, so a pinned popup replaces them with one that does nothing.
const stayOpen = { onPointerLeave: () => {} };

export function PopupTrigger(props: ComponentProps<typeof Twoslash.PopupTrigger>) {
  const { pinned, setPinned, trigger } = usePin();

  // Base UI closes the popup on a click outside it or on Escape; the pin goes with it. A drag of a
  // block's edge or divider swallows its click (swallowNextClick), so the popup stays.
  useEffect(() => {
    if (!pinned) return;
    const unpinOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!trigger.current?.contains(target) && !target.closest('.fd-twoslash-popover')) setPinned(false);
    };
    const unpinOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setPinned(false);
    document.addEventListener('click', unpinOutside, true);
    document.addEventListener('keydown', unpinOnEscape);
    return () => {
      document.removeEventListener('click', unpinOutside, true);
      document.removeEventListener('keydown', unpinOnEscape);
    };
  }, [pinned, setPinned, trigger]);

  return (
    <Twoslash.PopupTrigger
      {...props}
      {...(pinned ? stayOpen : {})}
      ref={trigger}
      data-pinned={pinned || undefined}
      onClick={(event) => {
        // A second click unpins, and Base UI's own handler closes the popup.
        if (pinned) return setPinned(false);
        // The first click pins. The hover has opened the popup already, or is about to, and Base
        // UI would toggle it shut.
        event.preventBaseUIHandler();
        setPinned(true);
      }}
    />
  );
}

/** The gap between a card and the edges of the block it stays inside, in px. */
const BLOCK_INSET = 12;

/**
 * A card opens under its name's left edge and stays inside its block: it is as wide as its type,
 * up to the block's width, so a type wraps only when the whole block is too narrow for it, and it
 * moves left as far as the block's edge when it would cross the block's right edge. The move is the
 * card's `translate`, which Base UI's positioning (the positioner's own offset) and its open
 * animation (`transform`) leave alone.
 */
export function PopupContent(props: ComponentProps<typeof Twoslash.PopupContent>) {
  const { pinned, trigger } = usePin();
  const fitToBlock = (card: HTMLDivElement | null) => {
    const name = trigger.current;
    const block = name?.closest('.ml-block');
    if (!card || !name || !block) return;
    const n = name.getBoundingClientRect();
    const b = block.getBoundingClientRect();
    card.style.maxWidth = `${b.width - 2 * BLOCK_INSET}px`;
    const left = Math.max(b.left + BLOCK_INSET, Math.min(n.left, b.right - BLOCK_INSET - card.offsetWidth));
    card.style.translate = `${left - n.left}px 0`;
  };
  return <Twoslash.PopupContent align="start" {...props} {...(pinned ? stayOpen : {})} ref={fitToBlock} />;
}
