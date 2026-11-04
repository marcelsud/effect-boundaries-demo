import { fileURLToPath } from "node:url"
import { defineConfig } from "oxlint"

type WorkspacePolicy = {
  name: string | null
  imports: string[]
}

// The only import-policy definition. Also used for manifest/reference checks.
export const workspacePolicy: Record<string, WorkspacePolicy> = {
  "packages/catalog": {
    name: "@shop/catalog",
    imports: ["packages/logistics", "packages/pricing"]
  },
  "packages/logistics": {
    name: "@shop/logistics", imports: []
  },
  "packages/pricing": { name: "@shop/pricing", imports: [] },
  "architecture": {
    name: null,
    imports: ["packages/catalog", "packages/logistics", "packages/pricing"]
  }
}

export const sourcePatterns = [
  "packages/*/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "architecture/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
]

export default defineConfig({
  categories: { correctness: "off" },
  plugins: ["typescript", "import"],
  jsPlugins: [
    "eslint-plugin-boundaries",
    { name: "architecture", specifier: "./scripts/oxlint-core-rules.mjs" }
  ],
  settings: {
    "boundaries/root-path": fileURLToPath(new URL(".", import.meta.url)),
    // The CLI scopes linting to src; imported dist and external files must
    // remain visible to the resolver/classifier.
    "boundaries/elements": Object.keys(workspacePolicy).map((id) => ({
      type: id, pattern: id, partialMatch: false
    })),
    "boundaries/flag-as-external": { unresolvableAlias: false, outsideRootPath: false },
    "import/resolver": {
      typescript: {
        project: [
          "packages/*/tsconfig.json", "packages/*/src/**/tsconfig.json",
          "architecture/tsconfig.json"
        ],
        alwaysTryTypes: true,
        noWarnOnMultipleProjects: true
      }
    }
  },
  rules: {
    "boundaries/no-unknown-files": "error",
    "boundaries/no-unknown-dependencies": "error",
    "boundaries/no-ignored-dependencies": "error",
    "boundaries/dependencies": ["error", {
      default: "disallow",
      checkAllOrigins: true,
      policies: [
        { allow: { to: { module: { origin: ["external", "core"] } } } },
        ...Object.entries(workspacePolicy).filter(([, rule]) => rule.imports.length).map(([id, rule]) => ({
          from: { element: { type: id } },
          allow: rule.imports.map((target) => ({
            to: {
              element: {
                type: target,
                fileInternalPath: ["src/index.ts", "dist/index.d.ts", "dist/index.js"]
              }
            },
            dependency: { source: workspacePolicy[target].name }
          }))
        }))
      ]
    }],
    "no-restricted-imports": ["error", {
      paths: ["node:module", "module"]
    }],
    "typescript/triple-slash-reference": ["error", { path: "never", types: "never", lib: "never" }],
    // Reuse ESLint's selector rule through Oxlint's JS plugin API. These are
    // syntax restrictions, not a custom import parser or resolver.
    "architecture/restricted-syntax": ["error",
      {
        selector: "ImportExpression:not([source.type='Literal']):not([source.type='TemplateLiteral'][source.expressions.length=0])",
        message: "Module paths must be string literals; computed imports cannot be checked"
      },
      {
        selector: "CallExpression[callee.name='require']:not([arguments.0.type='Literal']):not([arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0])",
        message: "Module paths must be string literals; computed require cannot be checked"
      },
      {
        selector: "Identifier[name='require']:not(CallExpression > Identifier.callee)",
        message: "Indirect require is not allowed; use a literal import"
      },
      {
        selector: "CallExpression[callee.name='require'][arguments.0.value=/^(node:)?module$/]",
        message: "Custom module loaders are not allowed in team code"
      }
    ]
  }
})
