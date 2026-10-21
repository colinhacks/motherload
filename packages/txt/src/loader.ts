// A `.txt` file's module: its text, a string (DESIGN.md, "The `.txt` and `.md` modules").
import { moduleLoader } from "@motherload/core";

export const loader = moduleLoader("@motherload/txt", [".txt"], /\.txt$/, (source) => ({
  code: `const data = ${JSON.stringify(source)};\nexport default data;\n`,
  types: "declare const data: string;\nexport default data;\n",
  problems: [],
}));
