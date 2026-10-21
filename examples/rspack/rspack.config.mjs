// A Node bundle: one ES module, dist/main.mjs, with every data file inside, run with
// `node dist/main.mjs` and no preload.
export default {
  mode: "production",
  target: "node24",
  entry: "./main.ts",
  output: { filename: "main.mjs", module: true, clean: true },
  module: {
    rules: [
      // Motherload: each data file becomes a module holding its parsed value, at build time.
      { test: /\.(toml|csv|md)$/, use: "motherload/webpack" },
      // Rspack's built-in SWC strips the types; tsc checks them.
      { test: /\.ts$/, loader: "builtin:swc-loader", options: { jsc: { parser: { syntax: "typescript" } } } },
    ],
  },
};
