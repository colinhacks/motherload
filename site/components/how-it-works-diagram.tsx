import type { ReactNode } from 'react';

// The site's theme variables, so the figure follows the light and dark themes as the text does.
const color = {
  text: 'var(--color-fd-foreground)',
  muted: 'var(--color-fd-muted-foreground)',
  headings: 'var(--color-fd-headings)',
  border: 'var(--color-fd-border)',
  card: 'var(--color-fd-card)',
  accent: 'var(--color-fd-primary)',
};
const mono = 'var(--font-code), ui-monospace, monospace';
const sans = 'var(--font-text), ui-sans-serif, system-ui, sans-serif';

const label =
  'How Motherload turns a data file into a typed module. TypeScript 7.1, in tsc and the editor, hands plans.toml to Motherload, its content mapper, and gets back its types: { readonly free: { readonly price: 0; readonly seats: 1 }; readonly pro: { readonly price: 12; readonly seats: 10 } }. At run time, the preload under Node.js or Nub, or the esbuild plugin, hands Motherload the same file and gets back a module whose data is { free: { price: 0, seats: 1 }, pro: { price: 12, seats: 10 } }.';

const nodes = [
  { title: 'TypeScript 7.1', note: 'tsc and the editor' },
  { title: 'Motherload', note: 'parses the file', accent: true },
  { title: 'your runtime or bundler', note: 'Node.js, Nub or esbuild' },
];

// What goes along each leg between two nodes: the file, from the node that imports it, and what
// comes back. TypeScript sits above Motherload and the runtime below it, so the file goes down the
// first leg and up the second.
const legs = [
  { request: 'plans.toml', answer: 'its types', down: true },
  { request: 'plans.toml', answer: 'a module', down: false },
];

type TextProps = { x: number; y: number; children: ReactNode; size?: number; fill?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; code?: boolean };

/** Real, selectable text in the page's own faces. `pre` keeps the indent of a wrapped type. */
function Text({ x, y, children, size = 12, fill = color.muted, weight = 400, anchor = 'start', code = false }: TextProps) {
  return (
    <text x={x} y={y} textAnchor={anchor} style={{ fill, fontFamily: code ? mono : sans, fontSize: size, fontWeight: weight, whiteSpace: 'pre' }}>
      {children}
    </text>
  );
}

/** A box with the code blocks' thin border and rounded corners; Motherload's in the accent. */
function Box({ x, y, w, h, accent = false }: { x: number; y: number; w: number; h: number; accent?: boolean }) {
  return <rect x={x} y={y} width={w} height={h} rx={12} style={{ fill: color.card, stroke: accent ? color.accent : color.border, strokeWidth: 1 }} />;
}

/** A rule across a box: solid under its title bar, dashed between the file and what it becomes. */
function Rule({ x, y, w, dashed = false }: { x: number; y: number; w: number; dashed?: boolean }) {
  return <line x1={x} x2={x + w} y1={y} y2={y} style={{ stroke: color.border, strokeDasharray: dashed ? '3 4' : undefined }} />;
}

/** A straight arrow from (x1, y1) to (x2, y2) with an open head, drawn thin and muted. */
function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const wing = (turn: number) => `${x2 - 5 * Math.cos(angle + turn)},${y2 - 5 * Math.sin(angle + turn)}`;
  return (
    <g style={{ stroke: color.muted, strokeWidth: 1.25, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polyline points={`${wing(0.6)} ${x2},${y2} ${wing(-0.6)}`} />
    </g>
  );
}

// Motherload's bars (public/motherload.svg), 13px tall, a little taller than the name's capitals,
// as in the site's header. The drawing's bars span x 1.5 to 30.5 and y 7.8 to 27.5 of its 32 units.
const barsScale = 13 / 19.7;
const barsWidth = 29 * barsScale;
const barsGap = 7;
// "Motherload" in IBM Plex Sans SemiBold at 15px, as the browser measures it.
const nameWidth = 79.6;

/** A node's name, centred on x with its baseline at y. Motherload's carries its bars before it, standing on the baseline. */
function NodeTitle({ x, y, node }: { x: number; y: number; node: (typeof nodes)[number] }) {
  if (!node.accent) {
    return <Text x={x} y={y} anchor="middle" size={15} weight={600} fill={color.headings}>{node.title}</Text>;
  }
  const left = x - (barsWidth + barsGap + nameWidth) / 2;
  return (
    <g>
      <g transform={`translate(${left - 1.5 * barsScale} ${y - 27.5 * barsScale}) scale(${barsScale})`}>
        <g stroke="#4a230d" strokeWidth={1.3} strokeLinejoin="round">
          <path d="M1.5 27.5H15.5L13.3 18.5H3.7Z" fill="#e4a636" />
          <path d="M16.5 27.5H30.5L28.3 18.5H18.7Z" fill="#e4a636" />
          <path d="M9 16.8H23L20.8 7.8H11.2Z" fill="#f2b93e" />
        </g>
        <g fill="#ffe696">
          <path d="M4.4 19.3H12.6L13 21H4Z" />
          <path d="M19.4 19.3H27.6L28 21H19Z" />
          <path d="M11.9 8.6H20.1L20.5 10.3H11.5Z" />
        </g>
      </g>
      <Text x={left + barsWidth + barsGap} y={y} size={15} weight={600} fill={color.headings}>{node.title}</Text>
    </g>
  );
}

function Figure({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={{ display: 'block', width: '100%', height: 'auto' }}>
      <title>{label}</title>
      {children}
    </svg>
  );
}

const boxHeight = 64;
const gap = 79;
const stackHeight = 3 * boxHeight + 2 * gap;
const cardHeight = stackHeight;

/** The three nodes stacked in a column `w` wide, each leg's file on the left of its arrows and the answer on the right. */
function Stack({ w }: { w: number }) {
  const ys = [0.5, 0.5 + boxHeight + gap, 0.5 + 2 * (boxHeight + gap)];
  const middle = w / 2;
  return (
    <g>
      {nodes.map((node, i) => (
        <g key={node.title}>
          <Box x={0.5} y={ys[i]} w={w - 1} h={boxHeight} accent={node.accent} />
          <NodeTitle x={middle} y={ys[i] + 28} node={node} />
          <Text x={middle} y={ys[i] + 48} anchor="middle" size={12.5}>{node.note}</Text>
        </g>
      ))}
      {legs.map((leg, i) => {
        const top = ys[i] + boxHeight + 10;
        const bottom = ys[i + 1] - 10;
        const baseline = (top + bottom) / 2 + 4;
        // The file travels from the importer to Motherload, the answer the other way.
        const [fileFrom, fileTo] = leg.down ? [top, bottom] : [bottom, top];
        return (
          <g key={leg.answer}>
            <Text x={middle - 20} y={baseline} anchor="end" code>{leg.request}</Text>
            <Arrow x1={middle - 8} y1={fileFrom} x2={middle - 8} y2={fileTo} />
            <Arrow x1={middle + 8} y1={fileTo} x2={middle + 8} y2={fileFrom} />
            <Text x={middle + 20} y={baseline}>{leg.answer}</Text>
          </g>
        );
      })}
    </g>
  );
}

/** The file, the types TypeScript gets for it and the data its module holds at run time, in a card 328px wide. */
function Card({ x, y }: { x: number; y: number }) {
  const w = 328;
  const pad = 16;
  const code = { size: 12.5, fill: color.headings, code: true };
  const file = { ...code, fill: color.text };
  return (
    <g transform={`translate(${x + 0.5} ${y + 0.5})`}>
      <Box x={0} y={0} w={w - 1} h={cardHeight - 1} />
      <Text x={pad} y={22} code>plans.toml</Text>
      <Rule x={0} y={34} w={w - 1} />
      <Text x={pad} y={58} {...file}>[free]</Text>
      <Text x={pad} y={76} {...file}>price = 0</Text>
      <Text x={pad} y={94} {...file}>seats = 1</Text>
      <Text x={pad} y={120} {...file}>[pro]</Text>
      <Text x={pad} y={138} {...file}>price = 12</Text>
      <Text x={pad} y={156} {...file}>seats = 10</Text>
      <Rule x={0} y={174} w={w - 1} dashed />
      <Text x={pad} y={198}>its types</Text>
      <Text x={pad} y={218} {...code}>{'{ readonly free: { readonly price: 0;'}</Text>
      <Text x={pad} y={236} {...code}>{'    readonly seats: 1 };'}</Text>
      <Text x={pad} y={254} {...code}>{'  readonly pro: { readonly price: 12;'}</Text>
      <Text x={pad} y={272} {...code}>{'    readonly seats: 10 } }'}</Text>
      <Text x={pad} y={300}>its data, at run time</Text>
      <Text x={pad} y={320} {...code}>{'{ free: { price: 0, seats: 1 },'}</Text>
      <Text x={pad} y={338} {...code}>{'  pro: { price: 12, seats: 10 } }'}</Text>
    </g>
  );
}

/**
 * The figure at the text column's width (640px, the 40rem column, at a 1440px window), drawn at
 * that size so its text is the size it was drawn at: the nodes stacked on the left and the file
 * with its types and its data on the right, so the figure meets both edges of the column.
 */
function Wide() {
  const w = 640;
  return (
    <Figure w={w} h={stackHeight + 1}>
      <Stack w={w - 328 - 16} />
      <Card x={w - 328} y={(stackHeight - cardHeight) / 2} />
    </Figure>
  );
}

/** The same figure for a phone's column (328px on a 360px screen): the stack, and the card under it. */
function Narrow() {
  const w = 328;
  const cardY = stackHeight + 24;
  return (
    <Figure w={w} h={cardY + cardHeight + 1}>
      <Stack w={w} />
      <Card x={0} y={cardY} />
    </Figure>
  );
}

/**
 * The diagram under How it works: a data file through TypeScript and Motherload, and through the
 * runtime or bundler and Motherload, with what each gets back. A container query picks the form, as
 * on Reylo's page: the wide one from a 560px column (drawn for the page's 640px), and the stacked one
 * below that, kept to 400px so that it does not grow larger than the page's text on a small tablet.
 */
export function HowItWorksDiagram() {
  return (
    <figure className="@container my-8">
      <div className="hidden @min-[560px]:block">
        <Wide />
      </div>
      <div className="max-w-[400px] @min-[560px]:hidden">
        <Narrow />
      </div>
    </figure>
  );
}
