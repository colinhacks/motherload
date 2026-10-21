// The text of a file @motherload/schema reads, as `import text from "./file.schema.jsonc?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/schema/client").

declare module "*.schema.jsonc?raw" {
  const text: string;
  export default text;
}

declare module "*.schema.json5?raw" {
  const text: string;
  export default text;
}
