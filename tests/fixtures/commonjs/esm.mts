// An ES module importing a data file from a package with no "type". The data file takes its
// package's format, as a .ts file does, so under nodenext its default import is the CommonJS module.
import config from "./config.toml";

const port: 8080 = config.port;
export { port };
