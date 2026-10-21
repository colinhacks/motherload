// An ES module importing a data file from a package with no "type", where a .ts module is CommonJS.
// The preload and the plugins load the data file as an ES module, so its default export is the data.
import config from "./config.toml";

const port: 8080 = config.port;
export { port };
