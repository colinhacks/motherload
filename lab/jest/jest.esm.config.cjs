// ES module run: `NODE_OPTIONS=--experimental-vm-modules jest -c jest.esm.config.cjs`.
module.exports = {
  testMatch: ["<rootDir>/data.test.cjs", "<rootDir>/data.test.mjs"],
  transform: { "\\.(toml|ya?ml|jsonc|json5|env|[ct]sv|txt|md)$": "motherload/jest" },
  extensionsToTreatAsEsm: [".toml", ".yaml", ".yml", ".jsonc", ".json5", ".env", ".csv", ".tsv", ".txt", ".md"],
};
