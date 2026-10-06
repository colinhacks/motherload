// The text of a file Motherload reads, as `import text from "./config.toml?raw"`. TypeScript
// resolves no query to a file, so these imports never reach the content mapper; a project types
// them by listing this file in tsconfig's `types` ("motherload/client"), as Vite's `?raw` is typed.

declare module "*.toml?raw" {
  const text: string;
  export default text;
}

declare module "*.yaml?raw" {
  const text: string;
  export default text;
}

declare module "*.yml?raw" {
  const text: string;
  export default text;
}

declare module "*.json5?raw" {
  const text: string;
  export default text;
}

declare module "*.jsonc?raw" {
  const text: string;
  export default text;
}

declare module "*.env?raw" {
  const text: string;
  export default text;
}

declare module "*.csv?raw" {
  const text: string;
  export default text;
}

declare module "*.tsv?raw" {
  const text: string;
  export default text;
}

declare module "*.txt?raw" {
  const text: string;
  export default text;
}

declare module "*.md?raw" {
  const text: string;
  export default text;
}

declare module "*.schema.json?raw" {
  const text: string;
  export default text;
}
