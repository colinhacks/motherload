// A `.csv` or `.tsv` file's module: the array of its rows, each an object keyed by the header's
// columns, read with csv-parse (DESIGN.md, "The CSV and TSV parser: csv-parse" and "The `.csv` and
// `.tsv` module").
import { parse as parseCsv, CsvError } from "csv-parse/sync";
import { BOM, CODES, FAILED_TYPES, moduleLoader, propertyName, toJs, type ModuleText, type Problem } from "@motherload/core";

/** A table: its header's column names, in order, and one object per later row, keyed by them. Every value is a string. */
export type ParsedTable = { ok: true; columns: string[]; rows: Record<string, string>[] } | { ok: false; problems: Problem[] };

/**
 * CSV (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes) or TSV (IANA
 * text/tab-separated-values: a tab between fields and no quoting, so `"` is an ordinary character),
 * read with csv-parse. Rows end in CRLF or LF, mixed in one file. A blank line is not a row,
 * wherever it is. The first row is the header; a row whose field count differs from the header's,
 * and an empty or repeated column name, are problems placed at that row.
 */
function parseTable(text: string, delimiter: "," | "\t"): ParsedTable {
  const skip = text.startsWith(BOM) ? 1 : 0;
  const source = text.slice(skip);
  // csv-parse counts UTF-8 bytes; every place it reports is a row's end, so a running count converts them.
  const bytes = Buffer.from(source, "utf8");
  let atByte = 0;
  let atChar = 0;
  const charOf = (byte: number) => {
    atChar += bytes.toString("utf8", atByte, byte).length;
    atByte = byte;
    return atChar;
  };
  const records: { fields: string[]; start: number; end: number }[] = [];
  let lastEnd = 0;
  try {
    parseCsv(source, {
      delimiter,
      quote: delimiter === "," ? '"' : false,
      record_delimiter: ["\r\n", "\n"],
      relax_column_count: true,
      on_record: (fields: string[], context) => {
        const start = lastEnd;
        lastEnd = charOf(context.bytes);
        records.push({ fields, start, end: lastEnd });
        return null;
      },
    });
  } catch (error) {
    if (!(error instanceof CsvError)) throw error;
    // Placed at the row that failed: where the previous row ended.
    const line = source.slice(lastEnd).split(/\r?\n/, 1)[0]!;
    return { ok: false, problems: [{ message: error.message.replace(/ at line \d+/, ""), start: skip + lastEnd, length: Math.max(line.length, 1), code: CODES.syntax }] };
  }
  const rowText = (r: { start: number; end: number }) => source.slice(r.start, r.end).replace(/\r?\n$/, "");
  const rows = records.filter((r) => !(r.fields.length === 1 && rowText(r) === ""));
  const [header, ...body] = rows;
  if (!header) return { ok: true, columns: [], rows: [] };
  const problems: Problem[] = [];
  const at = (r: (typeof rows)[number], message: string) => problems.push({ message, start: skip + r.start, length: Math.max(rowText(r).length, 1), code: CODES.syntax });
  const columns = header.fields;
  const seen = new Set<string>();
  columns.forEach((name, i) => {
    if (name === "") at(header, `Column ${i + 1} of the header has no name.`);
    else if (seen.has(name)) at(header, `The header names the column "${name}" twice.`);
    seen.add(name);
  });
  for (const row of body) if (row.fields.length !== columns.length) at(row, `This row has ${row.fields.length} field${row.fields.length === 1 ? "" : "s"}; the header has ${columns.length}.`);
  if (problems.length) return { ok: false, problems };
  return { ok: true, columns, rows: body.map((row) => Object.fromEntries(columns.map((name, i) => [name, row.fields[i]!]))) };
}

export const parseCsvFile = (source: string) => parseTable(source, ",");
export const parseTsvFile = (source: string) => parseTable(source, "\t");

/**
 * The array of the rows. Every value is a string, and the type is the column set, not each cell's
 * literal: a file of thousands of rows would otherwise be thousands of literal types. A file with no
 * header is `readonly never[]`, an array that holds no row.
 */
export function tableModule(source: string, path: string): ModuleText {
  const parsed = path.endsWith(".tsv") ? parseTsvFile(source) : parseCsvFile(source);
  if (!parsed.ok) return { code: "export default undefined;\n", types: FAILED_TYPES, problems: parsed.problems };
  const row = parsed.columns.length === 0 ? "never" : `{ ${parsed.columns.map((name) => `readonly ${propertyName(name)}: string`).join("; ")} }`;
  return {
    code: `const data = ${toJs(parsed.rows)};\nexport default data;\n`,
    types: `declare const data: readonly ${row}[];\nexport default data;\n`,
    problems: [],
  };
}

export const loader = moduleLoader("@motherload/csv", [".csv", ".tsv"], /\.(?:csv|tsv)$/, tableModule);
