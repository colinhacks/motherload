// Builds main.js with the bundler named on the command line (webpack, rspack, vite, rollup or
// rolldown) from its config file, and prints the build's errors, warnings and how many modules came
// from node_modules.
const name = process.argv[2];
const { default: config } = await import(`./${name}.config.mjs`);

/** The build's errors, warnings, and the ids of the modules in it. */
async function build() {
  if (name === "webpack" || name === "rspack") {
    const bundler = name === "rspack" ? (await import("@rspack/core")).rspack : (await import("webpack")).default;
    const stats = await new Promise((resolve, reject) => bundler(config, (error, stats) => (error ? reject(error) : resolve(stats))));
    const { errors, warnings, modules } = stats.toJson({ all: false, errors: true, warnings: true, modules: true });
    return { errors: errors.map((e) => e.message), warnings: warnings.map((w) => w.message), ids: modules.map((m) => m.name) };
  }
  const warnings = [];
  const onLog = (level, log) => void (level === "warn" && warnings.push(log.message));
  try {
    if (name === "vite") {
      const { build } = await import("vite");
      const [output] = [await build({ ...config, configFile: false, customLogger: { info() {}, warn: (m) => warnings.push(m), warnOnce: (m) => warnings.push(m), error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false } })].flat();
      return { errors: [], warnings, ids: output.output.flatMap((chunk) => chunk.moduleIds ?? []) };
    }
    const { [name]: bundle } = await import(name);
    const result = await bundle({ ...config, onLog });
    const { output } = await result.write(config.output);
    return { errors: [], warnings, ids: output.flatMap((chunk) => chunk.moduleIds ?? []) };
  } catch (error) {
    return { errors: [error.message], warnings, ids: [] };
  }
}

const { errors, warnings, ids } = await build();
for (const message of [...errors, ...warnings]) console.log(message);
console.log(`errors=${errors.length} warnings=${warnings.length} node_modules=${ids.filter((id) => /node_modules/.test(id)).length}`);
