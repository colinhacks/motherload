// The text of a file @motherload/txt reads, as `import text from "./file.txt?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/txt/client").

declare module "*.txt?raw" {
  const text: string;
  export default text;
}
