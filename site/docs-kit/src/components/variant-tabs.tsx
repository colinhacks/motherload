'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import type { ReactNode } from 'react';
import { prepaintMarks, usePrepaintReady } from './prepaint';

/*
 * One choice for the whole page among a few variants of the same content: a dialect, a package
 * manager, a framework. Fumadocs' code tabs marked `tab-group="<group>"` become
 * `<CodeBlockTabs groupId="<group>" persist>`, and every tabs root with a `groupId` joins one
 * listener set per id inside fumadocs-ui/dist/components/ui/tabs.js and saves the choice under that
 * id in sessionStorage and localStorage. These components are built on the same primitives (the
 * non-simple `Tabs`, whose values keep their case, unlike `<Tabs items>`, which lowercases them),
 * with the same `groupId` and `persist`, so a choice made in any of them, a code-tab strip
 * included, switches all of them and holds across reloads. A site wraps them once with its group
 * and values (Reylo's `<DialectTabs>` and `<Dialect>`). `tabsRestoreScript` (./head-scripts.ts)
 * puts a stale saved value right before the tabs read it, and every panel is server-rendered so the
 * saved one shows from the first paint (./prepaint.tsx).
 */

/**
 * `<VariantTabs group values>` shows a strip of the values above the panel of the chosen one.
 * `<VariantTabs group values follow>` shows no strip, only the chosen panel: it follows the choice
 * made elsewhere on the page, as the TypeScript under an example's tabbed SQL does.
 */
export function VariantTabs({ group, values, follow = false, children }: { group: string; values: readonly string[]; follow?: boolean; children: ReactNode }) {
  const ref = usePrepaintReady<HTMLDivElement>();
  return (
    <Tabs ref={ref} {...prepaintMarks(group, true)} groupId={group} persist defaultValue={values[0]} className={follow ? 'dk-variant-follow' : 'dk-variant-tabs'}>
      {!follow && (
        <TabsList>
          {values.map((value) => (
            <TabsTrigger key={value} value={value}>
              {value}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      {children}
    </Tabs>
  );
}

/** One variant's panel inside `<VariantTabs>`. */
export function Variant({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsContent value={value} forceMount className="dk-variant-panel">
      {children}
    </TabsContent>
  );
}
