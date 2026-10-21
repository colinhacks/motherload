/** A hast node, as much of one as the hanging indent reads. */
type HastNode = { type: string; value?: string; children?: HastNode[]; properties?: Record<string, unknown> };

const textOf = (node: HastNode): string => (node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join(''));

const hasClass = (node: HastNode, name: string) => {
  const value = node.properties?.class ?? node.properties?.className;
  return (Array.isArray(value) ? value : String(value ?? '').split(' ')).includes(name);
};

/** Writes a line's leading spaces as `--indent` on it, once. */
function markIndent(node: HastNode) {
  const style = String(node.properties?.style ?? '');
  if (style.includes('--indent')) return;
  const indent = /^ */.exec(textOf(node))![0].length;
  if (!indent) return;
  node.properties = { ...node.properties, style: [style, `--indent: ${indent}ch`].filter(Boolean).join('; ') };
}

/** Marks every `.line` under a node, the lines of a Twoslash popup's type included. */
function markLines(node: HastNode) {
  for (const child of node.children ?? []) {
    if (child.type !== 'element') continue;
    if (hasClass(child, 'line')) markIndent(child);
    markLines(child);
  }
}

/**
 * A Shiki transformer that writes each code line's own indent as `--indent`, so a line that wraps
 * on a narrow screen hangs two characters in from where the line starts, not from the block's edge
 * (style.css, "Code never scrolls sideways"). The type in a Twoslash popup is highlighted by a
 * second Shiki call with no transformers (fumadocs-twoslash's `renderMarkdown`), so its lines are
 * marked here too, at the root, once the popups are in the tree: on a phone a property such as
 * `kind: "click";` that wrapped came back at the popup's left edge, under the type's opening line.
 */
export const hangingIndent = {
  name: 'docs-kit:hanging-indent',
  line(node: HastNode) {
    markIndent(node);
  },
  root(node: HastNode) {
    markLines(node);
  },
};
