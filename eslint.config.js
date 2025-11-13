import { dirname } from "path";
import { fileURLToPath } from "url";

import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "**/*.min.js",
      "**/*.bundle.js",
      ".next/types/**/*.ts",
    ],
    rules: {
      // Enforce React hooks best practices (make explicit even if inherited)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      // Enforce consistent import ordering to match project conventions
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
        },
      ],

      // Prevent blanket eslint - disable usage to enforce fixing violations
      "no-warning-comments": [
        "error",
        {
          terms: [
            "eslint-disable",
            "eslint-disable-next-line",
            "eslint-disable-line",
          ],
          location: "anywhere",
        },
      ],
    },
  },
  // Special handling for Next.js generated files
  {
    files: ["next-env.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
];

export default eslintConfig;
