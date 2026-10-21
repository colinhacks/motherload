// A library that re-exports a schema module: its declarations must name the module's types.
import user from "./user.schema.jsonc";
import scores from "./scores.schema.jsonc";

export default user;
export const schemas = { user, scores };
export const total = (value: unknown): number | undefined => (scores.is(value) ? value.total + value["x-max"] : undefined);
export const check = (value: unknown) => user.is(value);
