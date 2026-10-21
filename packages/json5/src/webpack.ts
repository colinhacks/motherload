// The webpack loader, for webpack and Rspack, which take a loader for a file type:
//   module.rules: [{ test: /\.json5$/, use: "@motherload/json5/webpack" }]
// Next.js's Turbopack takes the same loader as @motherload/json5/turbopack.
import { standalone, toWebpackLoader } from "@motherload/core";
import { loader } from "./loader.ts";

export default toWebpackLoader(standalone(loader));
