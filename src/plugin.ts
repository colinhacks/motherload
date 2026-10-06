// motherload as one loader: each path goes to its format by its suffix (the longest first, so
// `user.schema.json` is a schema and `app.yaml` is data).
import { CODES, FILTER, formatOf, type Problem } from "./formats.ts";
import { dataModule } from "./data.ts";
import { schemaCode, schemaTypes } from "./schema.ts";
import type { LoaderPlugin } from "./universal.ts";

const READS = ".toml, .yaml, .yml, .json5, .jsonc, .env, .csv, .tsv, .txt, .md and .schema.json";

const unknownFormat = (path: string): Problem => ({ message: `Motherload reads ${READS} files; ${path} is none of them. Remove its extension from Motherload's contentMappers entry.`, start: 0, length: 1, code: CODES.unknownFormat });

export const plugin: LoaderPlugin = {
  name: "motherload",
  filter: FILTER,
  load(source, path) {
    const format = formatOf(path);
    if (!format) return { code: "export default undefined;\n", problems: [unknownFormat(path)] };
    if (format === "schema") return schemaCode(source, path);
    const { code, problems } = dataModule(format, source, path);
    return { code, problems };
  },
  async types(source, path) {
    const format = formatOf(path);
    // TypeScript routes every extension of the tsconfig entry here, including any motherload does not read.
    if (!format) return { types: "declare const data: any;\nexport default data;\n", problems: [unknownFormat(path)] };
    if (format === "schema") return schemaTypes(source, path);
    const { types, problems } = dataModule(format, source, path);
    return { types, problems };
  },
};
