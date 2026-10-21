// The webpack loader under Turbopack's name, for Next.js, which runs webpack loaders:
//   turbopack: { rules: { "*.toml": { loaders: ["@motherload/toml/turbopack"], as: "*.js" } } }
export { default } from "./webpack.ts";
