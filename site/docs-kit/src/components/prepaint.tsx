'use client';

import { CodeBlockTabs } from 'fumadocs-ui/components/codeblock';
import { useLayoutEffect, useRef, type ComponentProps } from 'react';

/*
 * Tabs whose choice is saved (`groupId`, and `persist` for one that outlives the tab) show the saved
 * choice from the first paint, before React hydrates, in three parts:
 * 1. The root of such a group server-renders every panel (`forceMount`), the inactive ones hidden
 *    by `[role=tabpanel][data-state=inactive]` in style.css, and carries `data-tab-group` (and
 *    `data-tab-persist`), which the head script's rules select.
 * 2. `TABS_PREPAINT_SCRIPT` (./head-scripts.ts), inline in the head, turns every saved choice in
 *    storage into CSS that shows the saved panel of a group not yet hydrated.
 * 3. `usePrepaintReady` marks the root `data-tabs-ready` in a layout effect, after Fumadocs' own
 *    layout effect has applied the saved value and before the browser paints, so from then on
 *    React's `data-state` decides and a click is never overridden by the saved value.
 */

export function usePrepaintReady<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    ref.current?.setAttribute('data-tabs-ready', '');
  }, []);
  return ref;
}

/** The attributes a tabs root with a saved choice carries. */
export function prepaintMarks(groupId?: string, persist?: boolean) {
  return groupId ? { 'data-tab-group': groupId, ...(persist ? { 'data-tab-persist': '' } : {}) } : {};
}

/** Fumadocs' `CodeBlockTabs`, marked for the head script's rules when its choice is saved. */
export function PrepaintCodeBlockTabs({ groupId, persist, ...props }: ComponentProps<typeof CodeBlockTabs>) {
  const ref = usePrepaintReady<HTMLDivElement>();
  return <CodeBlockTabs ref={ref} groupId={groupId} persist={persist} {...prepaintMarks(groupId, persist)} {...props} />;
}
