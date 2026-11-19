// A CommonJS module, as a .ts file in a package with no "type" is, importing a data file there.
import config from "./config.toml";

const port: 8080 = config.port;
export { port };
