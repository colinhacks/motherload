// A `.yaml` or `.yml` file's module: its data, typed as `as const` would type it. YAML 1.2, read
// with yaml (DESIGN.md, "The YAML parser: yaml"). `@motherload/md` reads a Markdown file's
// frontmatter with `parseYamlFile`.
import { parseAllDocuments } from "yaml";
import { carry, CODES, moduleLoader, valueModule, type Parsed, type Problem } from "@motherload/core";

export function parseYamlFile(source: string): Parsed {
  const documents = parseAllDocuments(source, { merge: true });
  // `parseAllDocuments` returns an EmptyStream (an empty array with extra fields) for a file with no document.
  const list = Array.from(documents);
  const problems: Problem[] = list.flatMap((doc) =>
    doc.errors.map((e) => ({ message: e.message.split("\n")[0]!.replace(/:$/, ""), start: e.pos[0], length: Math.max(e.pos[1] - e.pos[0], 1), code: CODES.syntax })),
  );
  if (problems.length) return { ok: false, problems };
  if (list.length === 0) return { ok: true, value: null };
  const values = list.map((doc) => doc.toJS());
  // One document is its value; several are the list of their values, in order.
  return carry(values.length === 1 ? values[0] : values);
}

export const loader = moduleLoader("@motherload/yaml", [".yaml", ".yml"], /\.ya?ml$/, (source) => valueModule(parseYamlFile(source)));
