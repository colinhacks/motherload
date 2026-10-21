// The CommonJS run: `nub run test:cjs`. Without --experimental-vm-modules, Jest loads only
// CommonJS, so Babel compiles the TypeScript files to it.
/** @type {import("jest").Config} */
export default {
  transform: {
    // Motherload: the same transformer writes a CommonJS module when Jest asks for one.
    "\\.(toml|csv|md)$": "motherload/jest",
    // preset-env compiles ES modules only when Jest asks for CommonJS; preset-typescript strips the types.
    "\\.ts$": [
      "babel-jest",
      { presets: [["@babel/preset-env", { targets: { node: "current" } }], "@babel/preset-typescript"] },
    ],
  },
};
