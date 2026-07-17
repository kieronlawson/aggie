import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", "dist/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: "error",
      "no-else-return": "error",
      complexity: ["error", 10],
      "max-params": ["error", 4],
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
      semi: ["error", "always"],
      "comma-dangle": ["error", "never"],
      indent: ["error", 2],
      "brace-style": ["error", "1tbs"],
      "linebreak-style": ["error", "unix"]
    }
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "max-lines-per-function": "off",
      "max-lines": "off"
    }
  }
);
