// The text of a file @motherload/json5 reads, as `import text from "./file.json5?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/json5/client").

declare module "*.json5?raw" {
  const text: string;
  export default text;
}
