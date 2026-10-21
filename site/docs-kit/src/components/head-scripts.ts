// The scripts `DocsDocument` (./document.tsx) puts inline in the document's head, in a module of
// their own.

/**
 * Puts each saved tab choice right before Fumadocs' tabs read it. Fumadocs' tabs take the value
 * saved under their `groupId` over their default, and a saved value that names no tab selects
 * nothing, so every group showed an empty panel until a tab was clicked (Reylo's page once saved
 * `postgres`, because `<Tabs items>` lowercases its values). For each group it keeps a saved value
 * that differs from one of `values` only in case, in that spelling, and drops any other value, so
 * the tabs fall back to their default. It runs before `TABS_PREPAINT_SCRIPT`.
 */
export function tabsRestoreScript(groups: Record<string, readonly string[]>): string {
  return `try {
  const groups = ${JSON.stringify(groups)};
  for (const store of [sessionStorage, localStorage]) {
    for (const [group, values] of Object.entries(groups)) {
      const saved = store.getItem(group);
      if (saved === null) continue;
      const value = values.find((v) => v.toLowerCase() === saved.toLowerCase());
      if (value) store.setItem(group, value);
      else store.removeItem(group);
    }
  }
} catch {}`;
}

/**
 * Shows each tab group's saved choice from the first paint, before React hydrates (./prepaint.tsx).
 * Fumadocs reads the saved value in a layout effect after hydration, and Radix server-renders only
 * the default panel, so a reader whose saved choice was not the default saw the default panels and
 * then every group switch: on Reylo's page, with MySQL saved, a layout shift on 20 of 20 reloads
 * near a group (up to 0.507). A group with a `groupId` now server-renders every panel, and this
 * turns every saved choice in storage into CSS that shows the saved panel and marks its trigger, on
 * groups not yet marked `data-tabs-ready`, for any `groupId`, with no list of groups. Radix gives
 * each panel the id `…-content-<value>` and each trigger `…-trigger-<value>`; a group with no panel
 * for the saved value is left alone (`:has`), as Fumadocs then selects nothing.
 */
export const TABS_PREPAINT_SCRIPT = `(() => { try {
  const q = (s) => '"' + String(s).replace(/["\\\\]/g, '\\\\$&').replace(/\\n/g, ' ') + '"';
  const rules = [];
  const add = (key, value, persistOnly) => {
    if (!value || value.length > 100) return;
    const group = '[data-tab-group=' + q(key) + ']' + (persistOnly ? '[data-tab-persist]' : '') + ':not([data-tabs-ready])';
    const panel = '[role=tabpanel][id$=' + q('-content-' + value) + ']';
    const trigger = '[role=tablist] > [role=tab][id$=' + q('-trigger-' + value) + ']';
    const g = group + ':has(> ' + panel + ')';
    rules.push(
      g + ' > [role=tabpanel] { display: none !important }',
      g + ' > ' + panel + ' { display: block !important }',
      g + ' > [role=tablist] > [role=tab] { color: var(--color-fd-muted-foreground) !important; border-color: transparent !important }',
      g + ' > [role=tablist] > [role=tab] > div { background: transparent !important }',
      g + ' > ' + trigger + ' { color: var(--color-fd-primary) !important; border-color: var(--color-fd-primary) !important }',
      g + ' > ' + trigger + ' > div { background: var(--color-fd-primary) !important }',
    );
  };
  const keys = new Set([...Object.keys(sessionStorage), ...Object.keys(localStorage)]);
  for (const key of keys) {
    const session = sessionStorage.getItem(key);
    if (session !== null) add(key, session, false);
    else add(key, localStorage.getItem(key), true);
  }
  if (!rules.length) return;
  const style = document.createElement('style');
  style.id = 'dk-tabs-prepaint';
  style.textContent = rules.join('\\n');
  document.head.appendChild(style);
} catch {} })();`;

/**
 * Keeps a control the reader presses under the pointer. Switching a tab switches every group of
 * the same `groupId`, above it too, and Chrome's scroll anchoring does not compensate when its
 * anchor is inside a group that switched (on Reylo's page the clicked tab moved up to 395px at 1440
 * wide and 511px at 390); folding a block from a toggle below it moves the toggle up by the block's
 * height. This records the control's top when it is pressed and, in the next animation frame (after
 * React has committed, before the browser paints), scrolls by however far it moved. Every
 * `[role=tab]` qualifies, and any element marked `[data-keep-in-place]` (a "Show less" toggle while
 * its block is open).
 */
export const KEEP_IN_PLACE_SCRIPT = `(() => {
  const SELECTOR = '[role="tab"], [data-keep-in-place]';
  const hold = (el) => {
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      const moved = el.getBoundingClientRect().top - top;
      if (Math.abs(moved) >= 1) window.scrollBy({ top: moved, behavior: 'instant' });
    });
  };
  addEventListener('pointerdown', (e) => hold(e.target.closest?.(SELECTOR)), true);
  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') hold(document.activeElement?.closest?.(SELECTOR));
  }, true);
})();`;
