import nx from "@nx/eslint-plugin";
import parser from "@typescript-eslint/parser";

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", ".nx/**"] },
  {
    files: ["**/*.ts"],
    languageOptions: { parser },
    plugins: { "@nx": nx },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          allow: [],
          banTransitiveDependencies: true,
        },
      ],
    },
  },
];
