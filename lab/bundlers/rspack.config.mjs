// Rspack bundles main.js into dist/rspack/main.cjs, each data file through motherload/webpack-loader.
export default {
  mode: "production",
  context: import.meta.dirname,
  entry: "./main.js",
  target: "node",
  output: { path: `${import.meta.dirname}/dist/rspack`, filename: "main.cjs" },
  module: {
    rules: [{ test: /\.(toml|ya?ml|jsonc|json5|env|[ct]sv|txt|md)$/, use: "motherload/webpack-loader" }],
  },
};
