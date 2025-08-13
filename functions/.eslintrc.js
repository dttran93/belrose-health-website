// functions/.eslintrc.js

module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
    "@typescript-eslint/recommended"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore compiled output
  ],
  plugins: [
    "@typescript-eslint",
  ],
  rules: {
    "quotes": ["error", "single"],
    "import/no-unresolved": 0,
    "indent": "off", // Conflicts with TypeScript
    "@typescript-eslint/indent": ["error", 2],
    "max-len": ["error", {"code": 120}]
  },
};