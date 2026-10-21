'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { Tabs as BareTabs, TabsList as BareTabsList, TabsTrigger as BareTabsTrigger } from 'fumadocs-ui/components/ui/tabs';
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

/**
 * `<VariantSwitch group values aside>`: the choice alone, a small segmented control with no panels,
 * for a code-tab group whose tabs are files and whose panels follow the page's choice. Inside a
 * code-tab group, marked `aside`, it is drawn at the right end of the group's strip
 * (./code-tabs.tsx): Reylo's examples show `main.ts | users_by_ids.sql` on the left and
 * Postgres | MySQL | SQLite on the right, where they had a tab per file and dialect,
 * `users_by_ids.sql (Postgres)` and so on, which wrapped onto two lines. It is built on Fumadocs'
 * unstyled tabs, which keep the same listener set per `groupId` as every other tabs root, so it
 * switches and follows them all; the head script shows its saved choice from the first paint
 * (`data-dk-switch`, ./head-scripts.ts). `label` names it for a screen reader.
 */
export function VariantSwitch({ group, values, label }: { group: string; values: readonly string[]; label?: string; aside?: boolean }) {
  const ref = usePrepaintReady<HTMLDivElement>();
  return (
    <BareTabs ref={ref} {...prepaintMarks(group, true)} data-dk-switch="" groupId={group} persist defaultValue={values[0]} className="dk-variant-switch">
      <BareTabsList aria-label={label}>
        {values.map((value) => (
          <BareTabsTrigger key={value} value={value}>
            {value}
          </BareTabsTrigger>
        ))}
      </BareTabsList>
    </BareTabs>
  );
}
