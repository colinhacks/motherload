// Two formats, each from its own package: every import is typed by that package's content mapper
// (`tsc --runExternalCode`), loaded by its preload
// (`node --import @motherload/jsonc/register --import @motherload/toml/register main.ts`) or
// bundled by its esbuild plugin.
import config from "./config.toml";
import settings from "./settings.jsonc";

// Exact equality of two types, not mere assignability.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const expect = <T extends true>() => {};

expect<Equal<typeof config, { readonly name: "packages"; readonly port: 8080 }>>();
expect<Equal<typeof settings, { readonly "editor.fontSize": 14 }>>();

console.log(JSON.stringify({ name: config.name, port: config.port, fontSize: settings["editor.fontSize"] }));
