// Gives each h2 and h3 its section as Markdown, for the heading's copy button
// (../components/heading.tsx): the text from the heading to the next heading of the same or a
// higher level, taken from the page's source, with what only the page needs removed, so the section
// pastes cleanly into an agent. It runs before a site's own remark plugins (the first of
// `docsMdxOptions`' remark plugins), so a block a site expands later, such as one copy per variant,
// is copied once, as it is written.

type Node = {
  type: string;
  depth?: number;
  position?: { start: { offset?: number } };
  data?: { hProperties?: Record<string, unknown> };
  children?: Node[];
};

/** A fenced code block, whole, from its opening fence to its closing one. */
const FENCE = /^```[^\n]*\n[\s\S]*?^```$/gm;

/** A fence's meta attribute, such as `tab="Postgres"`. */
const attribute = (meta: string, name: string) => meta.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];

/**
 * One fenced block as an agent should read it: the language alone on the fence, a label above it
 * for its tab and file name, and none of Twoslash's setup, directives and queries or the diff
 * markers.
 */
function cleanBlock(block: string): string {
  const newline = block.indexOf('\n');
  const [, lang = '', meta = ''] = block.slice(0, newline).match(/^```(\S*)\s*(.*)$/) ?? [];
  let body = block.slice(newline + 1, block.lastIndexOf('```'));
  // The setup a Twoslash block hides: everything above `---cut---` (or `---cut-before---`) and
  // everything below `---cut-after---`.
  body = body.replace(/^[\s\S]*?^\/\/ ---cut(?:-before)?---\n/m, '').replace(/^\/\/ ---cut-after---\n[\s\S]*$/m, '');
  body = body
    // Twoslash's directives (`// @noErrors`, `// @hover: …`), queries (`//    ^?`) and completions (`^|`).
    .replace(/^[ \t]*\/\/ @\w+.*\n/gm, '')
    .replace(/^[ \t]*\/\/\s*\^[?|][ \t]*\n/gm, '')
    // Shiki's diff and highlight markers.
    .replace(/[ \t]*\/\/ \[!code [^\]]*\]/g, '');
  // A tab that names a variant is bold; a file name, as a tab or a title, is code.
  const tab = attribute(meta, 'tab');
  const title = attribute(meta, 'title');
  const name = (text: string) => (/\.\w+$/.test(text) ? `\`${text}\`` : `**${text}**`);
  const parts = [tab, title].filter((part, i, all): part is string => !!part && all.indexOf(part) === i);
  const label = parts.length ? `${parts.map(name).join(', ')}:\n\n` : '';
  return `${label}\`\`\`${lang}\n${body}\`\`\``;
}

/** The prose between code blocks, with the page's components as plain Markdown. */
function cleanProse(text: string): string {
  return (
    text
      // MDX comments.
      .replace(/\{\/\*[\s\S]*?\*\/\}\n?/g, '')
      // A callout as a quote, its title in bold.
      .replace(/<Callout[^>]*?title="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/Callout>/g, (_, title: string, body: string) => `> **${title}.** ${body.replace(/\n/g, '\n> ')}`)
      .replace(/<Callout[^>]*>\s*([\s\S]*?)\s*<\/Callout>/g, (_, body: string) => `> ${body.replace(/\n/g, '\n> ')}`)
      // A component's opening tag alone on its line that names a value, a title or a summary (a tab,
      // a variant's panel, an accordion item, a `<Details>`) becomes that label in bold; any other
      // line holding only a component's tag (a tab group, a figure, a card) goes.
      .replace(/^[ \t]*<[A-Z]\w*\b[^>]*?\s(?:value|title|summary)="([^"]*)"[^>]*>[ \t]*$/gm, '**$1**')
      .replace(/^[ \t]*<\/?[A-Z]\w*\b[^>]*>[ \t]*\n?/gm, '')
      // HTML written for its class: a `<div>` line goes, a `<p>` is its text.
      .replace(/^[ \t]*<\/?div\b[^>]*>[ \t]*\n?/gm, '')
      .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/g, '$1')
  );
}

export function toAgentMarkdown(source: string): string {
  let out = '';
  let last = 0;
  for (const match of source.matchAll(FENCE)) {
    out += cleanProse(source.slice(last, match.index)) + cleanBlock(match[0]);
    last = match.index + match[0].length;
  }
  out += cleanProse(source.slice(last));
  return (
    out
      // A terminal block's colours are escape codes, which an agent reads as noise.
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

export function remarkSections() {
  return (tree: Node, file: { value: unknown }) => {
    const source = String(file.value);
    const headings = (tree.children ?? []).filter((node) => node.type === 'heading' && node.position?.start.offset !== undefined);
    headings.forEach((heading, i) => {
      if (heading.depth !== 2 && heading.depth !== 3) return;
      const next = headings.slice(i + 1).find((other) => other.depth! <= heading.depth!);
      const section = source.slice(heading.position!.start.offset, next?.position!.start.offset ?? source.length);
      heading.data ??= {};
      heading.data.hProperties = { ...heading.data.hProperties, 'data-section': toAgentMarkdown(section) };
    });
  };
}
