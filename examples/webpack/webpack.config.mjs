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
      // TypeScript 7's package has no JavaScript API, which ts-loader needs: swc strips the types.
      {
        test: /\.ts$/,
        use: { loader: "swc-loader", options: { jsc: { parser: { syntax: "typescript" }, target: "es2024" } } },
      },
    ],
  },
};
