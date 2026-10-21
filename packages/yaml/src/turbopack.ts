// The webpack loader under Turbopack's name, for Next.js, which runs webpack loaders:
//   turbopack: { rules: { "*.{yaml,yml}": { loaders: ["@motherload/yaml/turbopack"], as: "*.js" } } }
export { default } from "./webpack.ts";
