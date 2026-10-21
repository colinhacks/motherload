// The webpack loader under Turbopack's name, for Next.js, which runs webpack loaders:
//   turbopack: { rules: { "*.{csv,tsv}": { loaders: ["@motherload/csv/turbopack"], as: "*.js" } } }
export { default } from "./webpack.ts";
