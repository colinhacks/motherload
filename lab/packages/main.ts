// Three formats, each from its own package: every import is typed by that package's content
// mapper (`tsc --runExternalCode`), loaded by its preload
// (`node --import @motherload/schema/register --import @motherload/jsonc/register --import @motherload/toml/register main.ts`)
// or bundled by its esbuild plugin. user.schema.jsonc also ends in .jsonc and is the schema
// package's all the same, as TypeScript routes it, though the JSONC package's hook runs first.
import config from "./config.toml";
import settings from "./settings.jsonc";
import user, { type Type as User } from "./user.schema.jsonc";

// Exact equality of two types, not mere assignability.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const expect = <T extends true>() => {};

expect<Equal<typeof config, { readonly name: "packages"; readonly port: 8080 }>>();
expect<Equal<typeof settings, { readonly "editor.fontSize": 14 }>>();
expect<Equal<Pick<User, keyof User>, { name: string; role?: "admin" | "member" }>>();

const checked = user.validate({ name: "Ada", role: "admin" });
const ada: User | undefined = checked.issues ? undefined : checked.value;
console.log(JSON.stringify({ name: config.name, fontSize: settings["editor.fontSize"], ada, valid: user.is({ name: "Grace" }), invalid: user.is({ name: "" }) }));
