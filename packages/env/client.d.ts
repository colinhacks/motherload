// The text of a file @motherload/env reads, as `import text from "./file.env?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/env/client").

declare module "*.env?raw" {
  const text: string;
  export default text;
}
