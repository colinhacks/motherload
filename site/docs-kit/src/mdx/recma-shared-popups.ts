// Builds each distinct Twoslash popup once. A name hovered in several blocks, or in each copy of a
// block a site writes per variant, shows the same popup, and MDX writes one `_jsx(PopupContent, …)`
// call per occurrence (on Reylo's page of 2026-10-11, 829 popups, 253 of them different; the repeats
// were 1.2 MB of the page's 3.4 MB React payload, which the HTML carries too). This plugin moves
// each popup written more than once into a constant of `_createMdxContent` and puts the constant at
// each occurrence, so the page renders one element for it, and React's payload carries it once and
// each repeat as a reference to it. What renders is the same: the server-rendered HTML is
// identical, and a popup's content is drawn from that element when it opens.

type Node = { type: string; [key: string]: unknown };
type Slot = { parent: Record<string | number, unknown>; key: string | number };

/** Where a node came from, which differs between equal popups. */
const POSITION = new Set(['position', 'loc', 'range', 'start', 'end', 'comments']);

const isPopupContent = (node: Node) => {
  const callee = node.callee as Node | undefined;
  const type = (node.arguments as Node[] | undefined)?.[0];
  return node.type === 'CallExpression' && callee?.type === 'Identifier' && (callee.name === '_jsx' || callee.name === '_jsxs') && type?.type === 'Identifier' && type.name === 'PopupContent';
};

/** The node's code: its shape, without positions. */
const keyOf = (node: Node) => JSON.stringify(node, (key, value) => (POSITION.has(key) ? undefined : value));

export function recmaSharedPopups() {
  return (tree: Node) => {
    const fn = (tree.body as Node[]).find((node) => node.type === 'FunctionDeclaration' && (node.id as Node | null)?.name === '_createMdxContent');
    if (!fn) return;
    const popups = new Map<string, { node: Node; slots: Slot[] }>();
    const visit = (value: unknown, slot: Slot) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach((child, i) => visit(child, { parent: value as unknown as Record<number, unknown>, key: i }));
      const node = value as Node;
      if (isPopupContent(node)) {
        const key = keyOf(node);
        const popup = popups.get(key) ?? { node, slots: [] };
        popup.slots.push(slot);
        popups.set(key, popup);
        return;
      }
      for (const [key, child] of Object.entries(node)) if (!POSITION.has(key)) visit(child, { parent: node, key });
    };
    visit(fn.body, { parent: fn, key: 'body' });
    const declarations: Node[] = [];
    for (const { node, slots } of popups.values()) {
      if (slots.length < 2) continue;
      const name = `_popup${declarations.length}`;
      declarations.push({ type: 'VariableDeclarator', id: { type: 'Identifier', name }, init: node });
      for (const { parent, key } of slots) parent[key] = { type: 'Identifier', name };
    }
    // Just before the `return`: after the components the popups use are read from `props`.
    const statements = (fn.body as Node).body as Node[];
    const ret = statements.findIndex((node) => node.type === 'ReturnStatement');
    if (declarations.length && ret >= 0) statements.splice(ret, 0, { type: 'VariableDeclaration', kind: 'const', declarations });
  };
}
