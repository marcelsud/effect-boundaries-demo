import { spawnSync } from "node:child_process"
import { globSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { sourcePatterns } from "../oxlint.config.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
// Directory traversal in Oxlint honors .gitignore even with --no-ignore.
// Explicit files keep ignored/excluded source files inside the boundary check.
// All parsing, resolution and source rules are provided by Oxlint + Boundaries.
const files = [...globSync(sourcePatterns, { cwd: root })]
if (!files.length) throw new Error("No source files found for boundary checks")
const result = spawnSync(process.execPath, [
  join(root, "node_modules/oxlint/bin/oxlint"),
  "--config", join(root, "oxlint.config.ts"), "--no-ignore", ...files
], { cwd: root, stdio: "inherit" })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
