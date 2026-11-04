import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const fixture = join(root, "packages/catalog/src/_lint-fixtures")
const scratch = mkdtempSync(join(tmpdir(), "effect-lint-"))
const compiler = join(root, "node_modules/typescript/bin/tsc")
const privateSource = "../../../logistics/src/internal/InventoryRepository.js"
const privateBuilt = "../../../logistics/dist/internal/InventoryRepository.js"

function run(exe, args) {
  const result = spawnSync(exe, args, { cwd: root, encoding: "utf8", timeout: 30_000 })
  if (result.error) throw result.error
  return { status: result.status, output: result.stdout + result.stderr }
}
const lint = () => run("bun", ["run", "lint:boundaries"])
function rejected(result, code) {
  assert.equal(result.status, 1, result.output)
  assert.ok(result.output.includes(code), result.output)
}

let created = false
try {
  mkdirSync(fixture) // Refuse to overwrite an existing directory.
  created = true
  writeFileSync(join(fixture, "tsconfig.json"), JSON.stringify({
    extends: "../../tsconfig.json",
    compilerOptions: { paths: {
      "@private-inventory": ["../../../logistics/src/internal/InventoryRepository.ts"]
    } },
    include: ["*.ts"]
  }))

  // This is the precise loophole: private requirements are fully satisfied
  // internally, so both the local and central Layer input types accept it.
  const hidden = join(fixture, "hidden-provider.ts")
  writeFileSync(hidden, `
    import { Effect, Layer } from "effect"
    import { Catalog } from "@shop/catalog"
    import { InventoryRepository, InventoryRepositoryLive } from "${privateBuilt}"
    export const HiddenCatalog: Layer.Layer<Catalog> = Layer.effect(
      Catalog, Effect.gen(function* () {
        const inventory = yield* InventoryRepository
        return {
          getProduct: (productId: string) => inventory.quantity(productId).pipe(
            Effect.map((availableQuantity) => ({
              id: productId, name: "Stolen inventory", availableQuantity,
              price: { amountCents: 19900, currency: "BRL" }
            }))
          )
        }
      })
    ).pipe(Layer.provide(InventoryRepositoryLive))
  `)
  const typed = run(process.execPath, [compiler, "-p", "packages/catalog", "--noEmit",
    "--tsBuildInfoFile", join(scratch, "hidden.tsbuildinfo")])
  assert.equal(typed.status, 0, typed.output)
  const build = run("bun", ["run", "build"])
  rejected(build, "boundaries(dependencies)")
  assert.ok(build.output.includes("hidden-provider.ts"), build.output)
  console.log("PASS internally provided private repository type-checks alone but fails bun run build")
  rmSync(hidden)

  const cases = [
    ["source", `import { InventoryRepository } from "${privateSource}"`, "boundaries(dependencies)"],
    ["declaration", `import type { InventoryRepository } from "${privateBuilt}"`, "boundaries(dependencies)"],
    ["reexport", `export * from "${privateBuilt}"`, "boundaries(dependencies)"],
    ["dynamic", `void import("${privateBuilt}")`, "boundaries(dependencies)"],
    ["require", `require("${privateBuilt}")`, "boundaries(dependencies)"],
    ["import-type", `type Private = import("${privateBuilt}").InventoryRepository`, "boundaries(dependencies)"],
    ["alias", 'import { InventoryRepository } from "@private-inventory"', "boundaries(dependencies)"],
    ["named", 'import { InventoryRepository } from "@shop/logistics/internal/InventoryRepository"', "boundaries("],
    ["computed-import", `void import("../../../logistics/" + "dist/internal/Module.js")`, "architecture(restricted-syntax)"],
    ["computed-require", `require("../../../logistics/" + "dist/internal/Module.js")`, "architecture(restricted-syntax)"],
    ["indirect-require", "const loader = require", "architecture(restricted-syntax)"],
    ["custom-loader", 'import { createRequire } from "node:module"', "no-restricted-imports"],
    ["public-source-path", 'import { Logistics } from "../../../logistics/src/index.js"', "boundaries(dependencies)"],
    ["reference", `/// <reference path="../../../logistics/dist/internal/InventoryRepository.d.ts" />`, "triple-slash-reference"],
    ["pricing-private-source", 'import { PriceRepository } from "../../../pricing/src/internal/PriceRepository.js"', "boundaries(dependencies)"],
    ["pricing-private-declaration", 'import type { PriceRepository } from "../../../pricing/dist/internal/PriceRepository.js"', "boundaries(dependencies)"],
    ["pricing-private-subpath", 'import { PriceRepository } from "@shop/pricing/internal/PriceRepository"', "boundaries("]
  ]
  for (const [name, source] of cases) writeFileSync(join(fixture, `${name}.ts`), source)
  writeFileSync(join(fixture, "safe.ts"), `
    import { Logistics, LogisticsLive } from "@shop/logistics"
    import { Catalog, CatalogLive } from "@shop/catalog"
    import { Pricing, PricingLive } from "@shop/pricing"
    import type { Price } from "@shop/pricing"
    import { ProductRepository } from "../internal/ProductRepository.js"
    const effect = require("effect")
    // import { InventoryRepository } from "${privateBuilt}"
    const documentation = 'require("${privateBuilt}")'
    export { Logistics, LogisticsLive, Catalog, CatalogLive, ProductRepository, Pricing, PricingLive }
  `)
  const result = lint()
  rejected(result, "boundaries(dependencies)")
  for (const [name, , diagnostic] of cases) {
    assert.ok(result.output.split("\n").some((line) =>
      line.includes(`/${name}.ts:`) && line.includes(diagnostic)), result.output)
  }
  assert.ok(!result.output.includes("/safe.ts:"), result.output)
  console.log(`PASS ${cases.length} forbidden import forms; public APIs, own providers and comments remain allowed`)
  for (const [name] of cases) rmSync(join(fixture, `${name}.ts`))

  // A correct import spelling is not enough: it must resolve to index.ts.
  // This alias shadows the allowed public package name with a private file.
  const fixtureConfig = join(fixture, "tsconfig.json")
  const originalConfig = readFileSync(fixtureConfig, "utf8")
  for (const [name, repository] of [["pricing", "PriceRepository"], ["logistics", "InventoryRepository"]]) {
    const shadow = join(fixture, `${name}-public-name-shadow.ts`)
    try {
      const config = JSON.parse(originalConfig)
      config.compilerOptions.paths[`@shop/${name}`] = [`../../../${name}/src/internal/${repository}.ts`]
      writeFileSync(fixtureConfig, JSON.stringify(config))
      writeFileSync(shadow, `import { ${repository} } from "@shop/${name}"`)
      const result = lint()
      rejected(result, "boundaries(dependencies)")
      assert.ok(result.output.split("\n").some((line) =>
        line.includes(`/${name}-public-name-shadow.ts:`) && line.includes("boundaries(dependencies)")), result.output)
    } finally {
      writeFileSync(fixtureConfig, originalConfig)
      rmSync(shadow, { force: true })
    }
    console.log(`PASS the public ${name} package name cannot alias a private repository`)
  }

  // Declaring a forbidden package or project reference cannot grant access.
  for (const [file, update, diagnostic] of [
    ["packages/logistics/package.json", (json) => {
      json.dependencies["@shop/catalog"] = "*"
    }, "BOUNDARY_MANIFEST"],
    ["packages/logistics/tsconfig.json", (json) => {
      (json.references ??= []).push({ path: "../catalog" })
    }, "BOUNDARY_REFERENCE"]
  ]) {
    const path = join(root, file)
    const original = readFileSync(path, "utf8")
    try {
      const json = JSON.parse(original)
      update(json)
      writeFileSync(path, JSON.stringify(json, null, 2) + "\n")
      rejected(lint(), diagnostic)
    } finally {
      writeFileSync(path, original)
    }
    console.log(`PASS central policy rejects ${diagnostic}`)
  }
  assert.equal(lint().status, 0, "Allowed fixture should pass the linter")
} finally {
  if (created) rmSync(fixture, { recursive: true, force: true })
  rmSync(scratch, { recursive: true, force: true })
}
