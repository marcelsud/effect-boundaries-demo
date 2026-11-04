import { builtinRules } from "eslint/use-at-your-own-risk"

// Thin adapter for an existing ESLint core rule that Oxlint does not yet
// implement natively. All selectors and options live in oxlint.config.ts.
export default {
  meta: { name: "architecture" },
  rules: { "restricted-syntax": builtinRules.get("no-restricted-syntax") }
}
