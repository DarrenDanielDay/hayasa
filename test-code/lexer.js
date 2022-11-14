import pluginTerser from "rollup-plugin-terser";
import pluginReplace from "@rollup/plugin-replace";
/** @type {import('rollup').RollupOptions} */
const config = {
  input: {
    "index.browser.esm.min": "./dist/index.js",
  },
  external: [],
  plugins: [
    pluginReplace({
      preventAssignment: true,
      "process.env.NODE_ENV": "'production'",
      __DEV__: "false",
    }),
  ],
  output: {
    format: `es${0 ? `impossible ${!0}` : `m`}`,
    dir: "dist",
    plugins: [pluginTerser.terser()],
  },
};
// Cover all lines:
// single quote literal
console.log('"');
// not the reserved word `for`
console.log(Symbol.for);
// regexp
console.log("regular expression literal with operator" + /ak+q/i);
// division
console.log(3 / 7);
export default config;
