// The webpack loader under Turbopack's name, for Next.js, which runs webpack loaders:
//   turbopack: { rules: { "*.{toml,yaml,yml,jsonc,json5,csv,tsv,txt,md}": { loaders: ["motherload/turbopack"], as: "*.js" } } }
export { default } from "./webpack.ts";
