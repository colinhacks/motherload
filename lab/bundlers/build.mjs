// Builds main.js with the bundler named on the command line, `webpack` or `rspack`, from its
// config file, and prints the build's errors, warnings and how many modules came from node_modules.
const name = process.argv[2];
const [{ default: config }, bundler] = await Promise.all([import(`./${name}.config.mjs`), name === "rspack" ? import("@rspack/core").then((m) => m.rspack) : import("webpack").then((m) => m.default)]);

const stats = await new Promise((resolve, reject) => bundler(config, (error, stats) => (error ? reject(error) : resolve(stats))));
const { errors, warnings, modules } = stats.toJson({ all: false, errors: true, warnings: true, modules: true });
for (const e of [...errors, ...warnings]) console.log(e.message);
console.log(`errors=${errors.length} warnings=${warnings.length} node_modules=${modules.filter((m) => /node_modules/.test(m.name)).length}`);
