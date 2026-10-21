// CommonJS run: `jest -c jest.cjs.config.cjs`.
module.exports = {
  testMatch: ["<rootDir>/data.test.cjs"],
  transform: { "\\.(toml|ya?ml|jsonc|json5|env|[ct]sv|txt|md)$": "motherload/jest" },
};
