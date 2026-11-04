import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), "commerce-commit-demo-"))
const gitDir = join(scratch, "repo.git")
const modulePath = "packages/catalog/src/internal/Module.ts"
const moduleFile = join(root, modulePath)
const original = readFileSync(moduleFile, "utf8")
const environment = { ...process.env }
for (const key of Object.keys(environment)) {
  if (key.startsWith("GIT_")) delete environment[key]
}
Object.assign(environment, {
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: join(scratch, "empty-config"),
  GIT_TERMINAL_PROMPT: "0"
})

function run(command, args, allowFailure = false) {
  const result = spawnSync(command, args, {
    cwd: root, encoding: "utf8", timeout: 60_000,
    env: environment
  })
  if (result.error) throw result.error
  if (!allowFailure) assert.equal(result.status, 0, result.stdout + result.stderr)
  return result
}
const git = (args, allowFailure = false) => run("git", [
  `--git-dir=${gitDir}`, `--work-tree=${root}`, ...args
], allowFailure)

try {
  // Git metadata is disposable. The actual repository's .git and index are
  // never touched, even when this example already lives in a real checkout.
  mkdirSync(join(scratch, "empty-hooks"))
  writeFileSync(join(scratch, "empty-config"), "")
  git(["init", "--quiet"])
  git(["config", "user.name", "Boundary Simulation"])
  git(["config", "user.email", "boundary-demo@example.invalid"])
  git(["config", "commit.gpgSign", "false"])
  git(["config", "core.hooksPath", join(scratch, "empty-hooks")])
  git(["add", "--all"])
  git(["update-index", "--chmod=+x", ".githooks/pre-commit"])
  git(["commit", "--quiet", "-m", "Baseline: three team-owned services"])
  const before = git(["rev-parse", "HEAD"]).stdout.trim()

  chmodSync(join(root, ".githooks/pre-commit"), 0o755)
  git(["config", "core.hooksPath", join(root, ".githooks")])

  // Catalog may depend on @shop/pricing's public entry point. It attempts to
  // bypass that boundary by importing and supplying PriceRepository privately.
  writeFileSync(moduleFile, `import { Effect, Layer } from "effect"
import { Catalog, ProductUnavailable } from "../Catalog.js"
import {
  PriceRepository, PriceRepositoryLive
} from "../../../pricing/dist/internal/PriceRepository.js"

export const CatalogModule: Layer.Layer<Catalog> = Layer.effect(
  Catalog,
  Effect.gen(function* () {
    const prices = yield* PriceRepository
    return {
      getProduct: (productId: string) => Effect.gen(function* () {
        const price = yield* prices.find(productId)
        if (!price) return yield* Effect.fail(new ProductUnavailable({
          productId, message: "Price not found"
        }))
        return { id: productId, name: "Keyboard", availableQuantity: 12, price }
      })
    }
  })
).pipe(Layer.provide(PriceRepositoryLive))
`)

  console.log("$ tsc -p packages/catalog --noEmit")
  run(process.execPath, [
    join(root, "node_modules/typescript/bin/tsc"), "-p", "packages/catalog", "--noEmit",
    "--tsBuildInfoFile", join(scratch, "catalog.tsbuildinfo")
  ])
  console.log("PASS TypeScript alone: exported Layer requires no private provider")

  git(["add", "--", modulePath])
  console.log(`\n$ git diff --cached -- ${modulePath}`)
  console.log(git(["diff", "--cached", "--", modulePath]).stdout)
  console.log('$ git commit -m "Read pricing internals from Catalog"')
  const attempt = git(["commit", "-m", "Read pricing internals from Catalog"], true)
  const output = attempt.stdout + attempt.stderr
  console.log(output.trim())
  assert.notEqual(attempt.status, 0, "The invalid commit unexpectedly succeeded")
  assert.ok(output.includes("boundaries(dependencies)"), output)
  assert.ok(output.includes(modulePath), output)
  assert.equal(git(["rev-parse", "HEAD"]).stdout.trim(), before)
  console.log(`\nPASS commit rejected (exit ${attempt.status}); HEAD unchanged`)
} finally {
  writeFileSync(moduleFile, original)
  rmSync(scratch, { recursive: true, force: true })
  console.log("Catalog Module.ts restored; disposable Git metadata removed")
}
