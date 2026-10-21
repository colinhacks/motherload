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
 * for the saved value is left alone (`:has`), as Fumadocs then selects nothing. A `<VariantSwitch>`
 * (`data-dk-switch`), which has no panels, gets its saved choice drawn as the chosen trigger.
 *
 * It also makes a tab pressed before its group hydrates switch at once. The page hydrates late: on
 * Reylo's, 14,800 elements took 0.45s after the scripts arrived in the built site and several
 * seconds under the dev server, and a press on a tab in that time did nothing until React caught up
 * (the maintainer, 2026-10-21: "After I hard refresh the page and then I click on the
 * get_author.sql tab on the very first code block, there's a weirdly long delay before it changes
 * tabs").
 */
export const TABS_PREPAINT_SCRIPT = `(() => { try {
  const q = (s) => '"' + String(s).replace(/["\\\\]/g, '\\\\$&').replace(/\\n/g, ' ') + '"';
  const rules = [];
  // The rules that show \`value\`'s panel and mark its trigger in every tabs root \`root\` selects.
  const show = (root, value) => {
    if (!value || value.length > 100) return;
    const panel = '[role=tabpanel][id$=' + q('-content-' + value) + ']';
    const trigger = '[role=tablist] > [role=tab][id$=' + q('-trigger-' + value) + ']';
    const g = root + ':has(> ' + panel + ')';
    rules.push(
      g + ' > [role=tabpanel] { display: none !important }',
      g + ' > ' + panel + ' { display: block !important }',
      g + ' > [role=tablist] > [role=tab] { color: var(--color-fd-muted-foreground) !important; border-color: transparent !important }',
      g + ' > [role=tablist] > [role=tab] > div { background: transparent !important }',
      g + ' > ' + trigger + ' { color: var(--color-fd-primary) !important; border-color: var(--color-fd-primary) !important }',
      g + ' > ' + trigger + ' > div { background: var(--color-fd-primary) !important }',
    );
    // A <VariantSwitch> has no panels: its saved choice is the trigger drawn as chosen.
    const chosen = '[role=tab][id$=' + q('-trigger-' + value) + ']';
    const s = '[data-dk-switch]' + root + ':has(' + chosen + ')';
    rules.push(
      s + ' [role=tab] { color: var(--color-fd-muted-foreground) !important; background: transparent !important }',
      s + ' ' + chosen + ' { color: var(--color-fd-primary) !important; background: var(--dk-switch-on) !important }',
    );
  };
  const group = (key, persistOnly) => '[data-tab-group=' + q(key) + ']' + (persistOnly ? '[data-tab-persist]' : '') + ':not([data-tabs-ready])';
  const keys = new Set([...Object.keys(sessionStorage), ...Object.keys(localStorage)]);
  for (const key of keys) {
    const session = sessionStorage.getItem(key);
    if (session !== null) show(group(key, false), session);
    else show(group(key, true), localStorage.getItem(key));
  }
  const style = document.createElement('style');
  style.id = 'dk-tabs-prepaint';
  const flush = () => { style.textContent = rules.join('\\n'); };
  flush();
  document.head.appendChild(style);
  // A tab pressed before its group has hydrated (Radix selects on mousedown) shows at once. A
  // choice of a saved group is saved, as Fumadocs saves it, and shown in every group of its id;
  // another group's is shown in that group, and kept for the group to hand to React as it
  // hydrates (usePrepaintReady, ./prepaint.tsx).
  const pending = (window.__dkTabsPending = new Map());
  addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const tab = e.target.closest && e.target.closest('[role=tab]');
    const list = tab && tab.parentElement;
    const root = list && list.getAttribute('role') === 'tablist' ? list.parentElement : null;
    if (!root || root.hasAttribute('data-tabs-ready') || !root.matches('.dk-code-tabs, .dk-variant-tabs, .dk-variant-switch')) return;
    const at = tab.id.lastIndexOf('-trigger-');
    if (at < 0) return;
    const value = tab.id.slice(at + 9);
    const key = root.getAttribute('data-tab-group');
    if (key) {
      try {
        sessionStorage.setItem(key, value);
        if (root.hasAttribute('data-tab-persist')) localStorage.setItem(key, value);
      } catch {}
      show(group(key, false), value);
    } else {
      pending.set(root, tab.id);
      show(':not([data-tabs-ready]):has(> [role=tablist] > [id=' + q(tab.id) + '])', value);
    }
    flush();
  }, true);
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
