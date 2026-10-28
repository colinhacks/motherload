// A code block's errors, drawn as an editor draws them: a red squiggle under the exact range, and the
// message with its source (`reylo(6)`, `ts(2339)`) in a card pinned under the range's last line, in
// the page's popup style, in space the card opens there. The card never covers the code: every line
// of the block stays where it is and stays readable, the squiggle included.
//
// One card for every language. A Twoslash block's errors (`// @errors: 2322`) are drawn with it by
// ./twoslash.ts. Any other block carries its errors as directives, one per line, which a site's remark
// plugin writes into the block (Reylo's site writes the errors its content mapper gave each `.sql`
// example) or an author writes by hand:
//
//   // @diagnostic: 1:12-1:16 reylo(6) column "nmae" does not exist (42703)
//
// The range is the editor's: lines and columns count from 1, the end is the position after the
// range's last character, and a range may run over several lines. The source is one word, and the
// message runs to the end of the line, with `\n` for a line break and `\\` for a backslash. The
// directive lines come out of the block before it is highlighted (whatever the language's comment
// syntax), and the range counts the block without them.

/** A hast node, as much of one as this file reads and writes. */
type HastNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HastNode[] };
/** A Shiki token, as much of one as this file splits. */
type Token = { content: string; offset: number };
/** The part of Shiki's transformer context the hooks read, and the lines the `code` hook has. */
type Context = { meta: object; options: { meta?: { __raw?: string } } };
type LinesContext = Context & { lines: HastNode[] };

/** One error: its range (from 1, the end after its last character), its source and its message. */
export type Diagnostic = { start: Position; end: Position; source: string; message: string };
export type Position = { line: number; column: number };

const DIRECTIVE = /^\/\/ @diagnostic: (\d+):(\d+)-(\d+):(\d+) (\S+) (.*)(?:\n|$)/gm;

const unescape = (text: string) => text.replace(/\\(\\|n)/g, (_, c: string) => (c === 'n' ? '\n' : '\\'));

/** The block's text without its `// @diagnostic:` lines, and the diagnostics they carry. */
export function readDiagnostics(code: string): { code: string; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const stripped = code.replace(DIRECTIVE, (_, l1: string, c1: string, l2: string, c2: string, source: string, message: string) => {
    diagnostics.push({ start: { line: +l1, column: +c1 }, end: { line: +l2, column: +c2 }, source, message: unescape(message) });
    return '';
  });
  return { code: stripped, diagnostics };
}

/** A diagnostic as a directive line (its message escaped), for a remark plugin that writes them into a block. */
export function diagnosticDirective({ start, end, source, message }: Diagnostic): string {
  return `// @diagnostic: ${start.line}:${start.column}-${end.line}:${end.column} ${source} ${message.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}`;
}

const text = (value: string): HastNode => ({ type: 'text', value });
const element = (tagName: string, className: string, children: HastNode[]): HastNode => ({ type: 'element', tagName, properties: className ? { class: className } : {}, children });

/**
 * The pinned card of one error, a line of its own in the block: as many spaces as the column it
 * points at (from 0), then the card, the `^?` query's card with its arrow, holding the message and,
 * quieter after it, its source. On a phone it takes the block's width, as a query's card does
 * (style.css, "Pinned error cards").
 */
export function errorCard(column: number, message: string, source: string): HastNode {
  return element('div', 'twoslash-meta-line dk-error-line nd-copy-ignore', [
    element('span', '', [text(' '.repeat(Math.max(0, column)))]),
    element('span', 'twoslash-popup-container dk-error-popup nd-copy-ignore', [
      element('div', 'twoslash-popup-arrow', []),
      element('code', 'twoslash-popup-code dk-error-text', [element('span', 'dk-error-message', [text(message)]), text(' '), element('span', 'dk-error-source', [text(source)])]),
    ]),
  ]);
}

/** Every character of a line element's text, as Shiki wrote it. */
const textOf = (node: HastNode): string => (node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join(''));

/**
 * Puts each card after its line in the code element: after the line itself and after any card
 * already there, in order. Shiki separates lines with a newline text node, which a card, a block of
 * its own, takes the place of (as Twoslash's own lines do).
 */
export function insertCards(code: HastNode, lines: HastNode[], cards: { line: number; card: HastNode }[]) {
  const children = code.children ?? [];
  for (const { line, card } of cards) {
    const lineEl = lines[line];
    let index = lineEl ? children.indexOf(lineEl) : children.length - 1;
    if (index === -1) continue;
    while (children[index + 1]?.type === 'element' && hasClass(children[index + 1]!, 'twoslash-meta-line')) index++;
    const after = children[index + 1];
    if (after?.type === 'text' && after.value === '\n') children.splice(index + 1, 1);
    children.splice(index + 1, 0, card);
  }
}

const hasClass = (node: HastNode, name: string) => {
  const value = node.properties?.class ?? node.properties?.className;
  return (Array.isArray(value) ? value : String(value ?? '').split(' ')).includes(name);
};

/** Where a card points: under the range's first character on one line, under the last line's first marked character on several. */
function cardColumn(diagnostic: Diagnostic, lines: string[]): number {
  if (diagnostic.start.line === diagnostic.end.line) return diagnostic.start.column - 1;
  const last = lines[diagnostic.end.line - 1] ?? '';
  return Math.min(/^\s*/.exec(last)![0].length, diagnostic.end.column - 1);
}

/** Each line's marked columns, from 0, end excluded: the range's part of each line it runs over. */
function marks(diagnostic: Diagnostic, lines: string[]): { line: number; from: number; to: number }[] {
  const out = [];
  for (let line = diagnostic.start.line; line <= diagnostic.end.line; line++) {
    const length = (lines[line - 1] ?? '').length;
    if (!length) continue;
    let from = line === diagnostic.start.line ? diagnostic.start.column - 1 : 0;
    let to = line === diagnostic.end.line ? diagnostic.end.column - 1 : length;
    // An empty range, or one past the end of its line, still marks a character, as an editor does.
    if (from >= length) from = length - 1;
    to = Math.min(Math.max(to, from + 1), length);
    out.push({ line: line - 1, from, to });
  }
  return out;
}

/**
 * Wraps the token elements of a line that lie in `[from, to)` in one squiggled span; the tokens were
 * split at both ends beforehand (`tokens` below), so each lies wholly in or out.
 */
function squiggle(lineEl: HastNode, from: number, to: number) {
  const children = lineEl.children ?? [];
  let at = 0;
  let first = -1;
  let last = -1;
  children.forEach((child, i) => {
    const length = textOf(child).length;
    if (at >= from && at + length <= to && length > 0) {
      if (first === -1) first = i;
      last = i;
    }
    at += length;
  });
  if (first === -1) return;
  children.splice(first, last - first + 1, element('span', 'dk-error', children.slice(first, last + 1)));
}

/** Splits a line's tokens at a column, so a range's edge falls between two tokens. */
function splitAt<T extends Token>(line: T[], column: number): T[] {
  let at = 0;
  return line.flatMap((token) => {
    const start = at;
    at += token.content.length;
    if (column <= start || column >= at) return [token];
    const k = column - start;
    return [
      { ...token, content: token.content.slice(0, k) },
      { ...token, content: token.content.slice(k), offset: token.offset + k },
    ];
  });
}

const KEY = 'docsKitDiagnostics';
/** What `preprocess` found in a block, for the later hooks: its diagnostics and its lines without them. */
type Found = { diagnostics: Diagnostic[]; lines: string[] };

/**
 * The Shiki transformer that draws a block's `// @diagnostic:` lines (above). A `ts twoslash` block
 * is left to Twoslash, whose `// @errors` this file's card draws too (./twoslash.ts).
 */
export const diagnosticsTransformer = {
  name: 'docs-kit:diagnostics',
  preprocess(this: Context, code: string) {
    if (!code.includes('// @diagnostic: ') || /(?:^|\s)twoslash(?:\s|$)/.test(this.options.meta?.__raw ?? '')) return;
    const read = readDiagnostics(code);
    if (!read.diagnostics.length) return;
    (this.meta as Record<string, Found>)[KEY] = { diagnostics: read.diagnostics, lines: read.code.split('\n') };
    return read.code;
  },
  tokens<T extends Token>(this: Context, tokens: T[][]) {
    const found = (this.meta as Record<string, Found | undefined>)[KEY];
    if (!found) return;
    const out = tokens.map((line) => line);
    for (const diagnostic of found.diagnostics)
      for (const { line, from, to } of marks(diagnostic, found.lines)) if (out[line]) out[line] = splitAt(splitAt(out[line]!, from), to);
    return out;
  },
  code(this: LinesContext, code: HastNode) {
    const found = (this.meta as Record<string, Found | undefined>)[KEY];
    if (!found) return;
    for (const diagnostic of found.diagnostics) for (const { line, from, to } of marks(diagnostic, found.lines)) if (this.lines[line]) squiggle(this.lines[line]!, from, to);
    insertCards(
      code,
      this.lines,
      found.diagnostics.map((d) => ({ line: d.end.line - 1, card: errorCard(cardColumn(d, found.lines), d.message, d.source) })),
    );
  },
};
