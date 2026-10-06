// Gives each h2 and h3 its section as Markdown, for the heading's copy button
// (components/heading.tsx): the text from the heading to the next heading of the same or a
// higher level, taken from the page's source, with what only the page needs removed, so the
// section pastes cleanly into an agent.

type Node = {
  type: string;
  depth?: number;
  position?: { start: { offset?: number } };
  data?: { hProperties?: Record<string, unknown> };
  children?: Node[];
};

/** A fenced block without the setup a Twoslash block hides above its `---cut---` line. */
const withoutHiddenSetup = (block: string) => block.replace(/^(```[^\n]*\n)[\s\S]*?^\/\/ ---cut---\n/m, '$1');

export function toAgentMarkdown(source: string): string {
  return (
    source
      .replace(/^```[^\n]*\n[\s\S]*?^```$/gm, (block) => (block.includes('// ---cut---') ? withoutHiddenSetup(block) : block))
      // Twoslash queries and diff markers are for the page.
      .replace(/^[ \t]*\/\/\s*\^\?[ \t]*\n/gm, '')
      .replace(/[ \t]*\/\/ \[!code [+-]+\]/g, '')
      .replace(/^(```\w*)[ \t]+twoslash/gm, '$1')
      // A terminal block's colours are escape codes, which an agent reads as noise.
      .replace(/\x1b\[[0-9;]*m/g, '')
      // The page's components as plain Markdown.
      .replace(/<Callout[^>]*?title="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/Callout>/g, (_, title: string, body: string) => `> **${title}.** ${body.replace(/\n/g, '\n> ')}`)
      .replace(/^<Tab value="([^"]*)">$/gm, '**$1**')
      .replace(/^<Accordion title="([^"]*)"[^>]*>$/gm, '**$1**')
      .replace(/^<\/?(?:Tabs|Tab|Accordions|Accordion)\b[^>]*>\n?/gm, '')
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
