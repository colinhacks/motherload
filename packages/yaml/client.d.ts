// The text of a file @motherload/yaml reads, as `import text from "./file.yaml?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/yaml/client").

declare module "*.yaml?raw" {
  const text: string;
  export default text;
}

declare module "*.yml?raw" {
  const text: string;
  export default text;
}
