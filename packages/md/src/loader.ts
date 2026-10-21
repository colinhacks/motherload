// A `.md` file's module (DESIGN.md, "The `.txt` and `.md` modules"): its body and its YAML
// frontmatter, which `@motherload/yaml` reads as it reads a `.yaml` file.
import { parseYamlFile } from "@motherload/yaml/loader";
import { BOM, CODES, literal, moduleLoader, toJs, type ModuleText, type Problem, type Value } from "@motherload/core";

export type ParsedMarkdown = { ok: true; frontmatter: Value; body: string } | { ok: false; problems: Problem[] };

/**
 * A Markdown file's YAML frontmatter and its body. The frontmatter is a `---` line at the very
 * start of the file, closed by the next `---` line, read as a `.yaml` file is; the body is the text
 * after the closing line. With no frontmatter, or an empty one, the frontmatter is `{}`.
 */
export function parseMarkdownFile(text: string): ParsedMarkdown {
  const skip = text.startsWith(BOM) ? 1 : 0;
  const open = /^---[ \t]*\r?\n/.exec(text.slice(skip));
  if (!open) return { ok: true, frontmatter: {}, body: text };
  const from = skip + open[0].length;
  const close = /^---[ \t]*(?:\r?\n|$)/gm;
  close.lastIndex = from;
  const closed = close.exec(text);
  if (!closed) return { ok: false, problems: [{ message: "The frontmatter that starts here has no closing --- line.", start: skip, length: 3, code: CODES.syntax }] };
  const yaml = text.slice(from, closed.index);
  const parsed = parseYamlFile(yaml);
  // yaml's messages name a line and column inside the frontmatter, which the diagnostic's own place replaces.
  if (!parsed.ok) return { ok: false, problems: parsed.problems.map((p) => ({ ...p, message: p.message.replace(/ at line \d+, column \d+$/, ""), start: from + p.start })) };
  const value = parsed.value ?? {};
  if (typeof value !== "object" || Array.isArray(value) || value instanceof Date) {
    return { ok: false, problems: [{ message: "The frontmatter must be a YAML mapping of keys to values.", start: from, length: Math.max(yaml.replace(/\s+$/, "").length, 1), code: CODES.syntax }] };
  }
  return { ok: true, frontmatter: value, body: text.slice(closed.index + closed[0].length) };
}

/**
 * The default export is the object `{ md, frontmatter }`: the body without the frontmatter, and the
 * frontmatter typed as `as const` would type it (`{}` when the file has none). Each is also a named
 * export, so a bundle that imports only `frontmatter` can leave the body out. The default's type
 * spells the frontmatter out again rather than as `typeof frontmatter`, so a hover on the import
 * shows the whole type. `md` is a string even when the frontmatter fails, since its type does not
 * depend on the file.
 */
export function markdownModule(source: string): ModuleText {
  const parsed = parseMarkdownFile(source);
  const codeOf = (md: string, frontmatter: string) =>
    `export const md = ${md};\nexport const frontmatter = ${frontmatter};\nexport default { md, frontmatter };\n`;
  const typesOf = (frontmatter: string) =>
    `export declare const md: string;\nexport declare const frontmatter: ${frontmatter};\ndeclare const data: { readonly md: string; readonly frontmatter: ${frontmatter} };\nexport default data;\n`;
  if (!parsed.ok) return { code: codeOf("undefined", "undefined"), types: typesOf("any"), problems: parsed.problems };
  return { code: codeOf(JSON.stringify(parsed.body), toJs(parsed.frontmatter)), types: typesOf(literal(parsed.frontmatter)), problems: [] };
}

export const loader = moduleLoader("@motherload/md", [".md"], /\.md$/, markdownModule);
