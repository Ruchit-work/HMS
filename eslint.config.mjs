import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "*.config.js",
      "*.config.mjs",
      "package-lock.json",
      "scripts/**", // Scripts use require() which is fine
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      // Stricter rules for production
      "@typescript-eslint/no-explicit-any": "warn", // Warn on 'any' types
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-unused-vars": "off", // Turn off base rule as it conflicts with @typescript-eslint version
      "unused-imports/no-unused-imports": "warn", // Warn on unused imports
      "unused-imports/no-unused-vars": "off", // Disable this as we use @typescript-eslint version
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
