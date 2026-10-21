// The text of a file @motherload/csv reads, as `import text from "./file.csv?raw"`. TypeScript resolves no
// query to a file, so these imports never reach the content mapper; a project types them by listing
// this file in tsconfig's `types` ("@motherload/csv/client").

declare module "*.csv?raw" {
  const text: string;
  export default text;
}

declare module "*.tsv?raw" {
  const text: string;
  export default text;
}
