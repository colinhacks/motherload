// The webpack loader, for webpack and Rspack, which take a loader for a file type:
//   module.rules: [{ test: /\.[ct]sv$/, use: "@motherload/csv/webpack" }]
// Next.js's Turbopack takes the same loader as @motherload/csv/turbopack.
import { standalone, toWebpackLoader } from "@motherload/core";
import { loader } from "./loader.ts";

export default toWebpackLoader(standalone(loader));
