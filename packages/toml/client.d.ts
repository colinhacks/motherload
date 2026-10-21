// The text of a file @motherload/toml reads, as `import text from "./file.toml?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/toml/client").

declare module "*.toml?raw" {
  const text: string;
  export default text;
}
