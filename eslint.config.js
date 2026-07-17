import stylistic from "@stylistic/eslint-plugin";
import { defineConfig } from "eslint/config";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const MAX_PARAMS = 4;
const MAX_COMPLEXITY = 10;
const MAX_FUNCTION_LINES = 80;
const MAX_FILE_LINES = 500;
const MAX_LINE_LENGTH = 120;

const bannedSyntax = [
  { selector: "ClassDeclaration", message: "No classes — use plain objects, factory functions, or closures." },
  { selector: "ClassExpression", message: "No classes — use plain objects, factory functions, or closures." },
  { selector: "ForStatement", message: "No loops — use R.map / R.filter / reduce." },
  { selector: "ForInStatement", message: "No for...in — use R.forEachObjIndexed or Object.entries().map()." },
  { selector: "ForOfStatement", message: "No loops — use R.map / R.filter / reduce." },
  { selector: "WhileStatement", message: "No while — use recursion, R.unfold, or R.until." },
  { selector: "DoWhileStatement", message: "No do...while — use recursion, R.unfold, or R.until." },
  { selector: "SwitchStatement", message: "No switch — use R.cond." },
  { selector: "IfStatement[alternate]", message: "No if...else — use early returns, R.cond, or a ternary." },
  { selector: "ConditionalExpression > ConditionalExpression", message: "No nested ternaries — use R.cond." },
  { selector: "LabeledStatement", message: "No labels." },
  { selector: "VariableDeclaration[kind='let']", message: "No let — every binding is const." },
  { selector: "VariableDeclaration[kind='var']", message: "No var — every binding is const." },
  {
    selector: "BinaryExpression[operator=/^[!=]==$/][left.type!='UnaryExpression'] > Literal.right[raw=/^[\"']/]",
    message: "No inline string literal comparisons — extract a named constant or enum."
  }
];

export default defineConfig(
  { ignores: ["node_modules"] },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.js"] },
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: { "@stylistic": stylistic, "simple-import-sort": simpleImportSort },
    rules: {
      "no-restricted-syntax": ["error", ...bannedSyntax],
      "prefer-const": "error",
      "no-param-reassign": "error",
      "curly": ["error", "all"],
      "max-params": ["error", MAX_PARAMS],
      "complexity": ["error", MAX_COMPLEXITY],
      "max-lines-per-function": ["error", { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true }],
      "max-lines": ["error", { max: MAX_FILE_LINES, skipBlankLines: true, skipComments: true }],
      "no-magic-numbers": ["error", { ignore: [0, 1, -1] }],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@stylistic/indent": ["error", 2],
      "@stylistic/quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: "always" }],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/comma-dangle": ["error", "never"],
      "@stylistic/max-len": ["error", { code: MAX_LINE_LENGTH, ignoreUrls: true, ignoreStrings: true }],
      "@stylistic/brace-style": ["error", "1tbs"],
      "@stylistic/object-curly-spacing": ["error", "always"],
      "@stylistic/array-bracket-spacing": ["error", "never"],
      "@stylistic/space-in-parens": ["error", "never"],
      "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxBOF: 0, maxEOF: 0 }],
      "@stylistic/keyword-spacing": ["error", { before: true, after: true }],
      "@stylistic/space-before-blocks": ["error", "always"],
      "@stylistic/member-delimiter-style": ["error", {
        multiline: { delimiter: "semi", requireLast: true },
        singleline: { delimiter: "semi", requireLast: false }
      }]
    }
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "no-magic-numbers": "off",
      "prefer-const": "off",
      "max-lines-per-function": "off",
      "no-restricted-syntax": ["error", ...bannedSyntax.filter((r) => !r.selector.startsWith("BinaryExpression"))]
    }
  },
  {
    files: ["*.js", "*.config.ts"],
    rules: {
      "no-magic-numbers": "off",
      "@typescript-eslint/explicit-function-return-type": "off"
    }
  }
);
