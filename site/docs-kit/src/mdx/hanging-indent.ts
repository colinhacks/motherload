/** A hast node, as much of one as the hanging indent reads. */
type HastNode = { type: string; value?: string; children?: HastNode[]; properties?: Record<string, unknown> };

const textOf = (node: HastNode): string => (node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join(''));

/**
 * A Shiki transformer that writes each code line's own indent as `--indent`, so a line that wraps
 * on a narrow screen hangs two characters in from where the line starts, not from the block's edge
 * (style.css, "Code never scrolls sideways").
 */
export const hangingIndent = {
  name: 'docs-kit:hanging-indent',
  line(node: HastNode) {
    const indent = /^ */.exec(textOf(node))![0].length;
    if (!indent) return;
    const style = [node.properties?.style, `--indent: ${indent}ch`].filter(Boolean).join('; ');
    node.properties = { ...node.properties, style };
  },
};
