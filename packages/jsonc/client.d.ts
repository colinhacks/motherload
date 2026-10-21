// The text of a file @motherload/jsonc reads, as `import text from "./file.jsonc?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/jsonc/client").

declare module "*.jsonc?raw" {
  const text: string;
  export default text;
}
