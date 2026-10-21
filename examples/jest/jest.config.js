// The ES module run: `nub run test`, which starts Jest with Node's --experimental-vm-modules.
/** @type {import("jest").Config} */
export default {
  // Motherload: Jest loads tests through its own runtime, which no preload reaches, so this
  // transformer turns each data file into its module.
  transform: { "\\.(toml|csv|md)$": "motherload/jest" },
  // Motherload: a data file's module is an ES module, like the .ts files that import it (Jest
  // strips their types itself, since no transform claims them).
  extensionsToTreatAsEsm: [".ts", ".toml", ".csv", ".md"],
};
