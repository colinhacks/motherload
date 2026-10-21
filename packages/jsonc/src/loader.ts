// A `.jsonc` file's module: its data, typed as `as const` would type it. JSON with comments, and
// trailing commas allowed, read with Microsoft's jsonc-parser (DESIGN.md, "The JSONC parser:
// jsonc-parser"). `@motherload/schema` reads a `.schema.jsonc` file with `parseJsoncFile`.
import { parseTree, printParseErrorCode, type Node, type ParseError } from "jsonc-parser";
import { carry, CODES, moduleLoader, valueModule, type Parsed } from "@motherload/core";

/** jsonc-parser's own `parse` assigns keys, which turns a `"__proto__"` key into a prototype; building from the tree defines them. */
function fromTree(node: Node): unknown {
  switch (node.type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const property of node.children ?? []) {
        const [name, value] = property.children ?? [];
        if (!name || !value) continue;
        Object.defineProperty(out, name.value as string, { value: fromTree(value), enumerable: true, writable: true, configurable: true });
      }
      return out;
    }
    case "array":
      return (node.children ?? []).map(fromTree);
    default:
      return node.value;
  }
}

/** JSONC: JSON with comments, and trailing commas allowed. */
export function parseJsoncFile(source: string): Parsed {
  const errors: ParseError[] = [];
  const tree = parseTree(source, errors, { allowTrailingComma: true, disallowComments: false, allowEmptyContent: false });
  if (errors.length) return { ok: false, problems: errors.map((e) => ({ message: printParseErrorCode(e.error).replace(/([a-z])([A-Z])/g, "$1 $2"), start: e.offset, length: Math.max(e.length, 1), code: CODES.syntax })) };
  return carry(tree ? fromTree(tree) : null);
}

export const loader = moduleLoader("@motherload/jsonc", [".jsonc"], /\.jsonc$/, (source) => valueModule(parseJsoncFile(source)));
