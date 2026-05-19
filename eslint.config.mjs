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
      "public/**", // Generated PWA / workbox bundles — not app source
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
      // Legacy codebase uses `any` widely; tightening is a separate typing pass (no runtime impact)
      "@typescript-eslint/no-explicit-any": "off",
      // Hook deps are validated manually on critical paths; blanket warns are noisy on legacy screens
      "react-hooks/exhaustive-deps": "off",
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
