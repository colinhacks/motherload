// The text of a file @motherload/md reads, as `import text from "./file.md?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/md/client").

declare module "*.md?raw" {
  const text: string;
  export default text;
}
