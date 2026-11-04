import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const compiler = join(root, "node_modules/typescript/bin/tsc")
const scratch = await mkdtemp(join(tmpdir(), "effect-boundaries-"))

// No @ts-expect-error: each case actually runs tsc and must fail as specified.
const cases = [
  {
    name: "Private repository is absent from the public API",
    project: "packages/catalog", diagnostic: "TS2305",
    source: `
      import { InventoryRepository } from "@shop/logistics"
      export const stolen = InventoryRepository
    `
  },
  {
    name: "Logistics package exports reject a private named subpath",
    project: "packages/catalog", diagnostic: "TS2307",
    source: `
      import { InventoryRepository } from "@shop/logistics/internal/InventoryRepository"
      export const stolen = InventoryRepository
    `
  },
  {
    name: "Logistics cannot pull Catalog private source into its project",
    project: "packages/logistics", diagnostic: "TS6059",
    source: `
      import { ProductRepository } from "../../catalog/src/internal/ProductRepository.js"
      export const stolen = ProductRepository
    `
  },
  {
    name: "Catalog's declared Layer inputs reject a private Logistics requirement",
    project: "packages/catalog", diagnostic: "TS2322",
    // Deliberately import built declarations to bypass source-project checks.
    // This independently verifies the Layer boundary.
    source: `
      import { Effect, Layer } from "effect"
      import { Catalog, CatalogLive } from "@shop/catalog"
      import { Logistics } from "@shop/logistics"
      import { Pricing } from "@shop/pricing"
      import { InventoryRepository } from "../../logistics/dist/internal/InventoryRepository.js"

      export const forbidden: Layer.Layer<Catalog, never, Logistics | Pricing> =
        Layer.effect(Catalog, Effect.gen(function* () {
          yield* InventoryRepository
          return yield* Catalog
        })).pipe(Layer.provide(CatalogLive))
    `
  },
  {
    name: "LogisticsLive does not expose its private repository",
    project: "packages/catalog", diagnostic: "TS2345",
    source: `
      import { Effect } from "effect"
      import { InventoryRepository } from "../../logistics/dist/internal/InventoryRepository.js"
      import { LogisticsLive } from "@shop/logistics"

      const forbidden = Effect.gen(function* () {
        return yield* InventoryRepository
      })
      Effect.runPromise(forbidden.pipe(Effect.provide(LogisticsLive)))
    `
  },
  {
    name: "Widening Catalog's local input type still violates the central policy",
    project: "architecture", diagnostic: "TS2322",
    source: `
      import type { Layer } from "effect"
      import { CatalogLive, type Catalog } from "@shop/catalog"
      import type { Logistics } from "@shop/logistics"
      import type { Pricing } from "@shop/pricing"
      import type { InventoryRepository } from "../../packages/logistics/dist/internal/InventoryRepository.js"
      import type { ModulePolicy } from "./check.js"

      const locallyWidened: Layer.Layer<
        Catalog, never, Logistics | Pricing | InventoryRepository
      > = CatalogLive

      export const forbidden: ModulePolicy["catalog"] = locallyWidened
    `
  },
  {
    name: "Pricing's public barrel does not export its repository",
    project: "packages/catalog", diagnostic: "TS2305",
    source: `
      import { PriceRepository } from "@shop/pricing"
      export const stolen = PriceRepository
    `
  },
  {
    name: "Pricing package exports reject a private named subpath",
    project: "packages/catalog", diagnostic: "TS2307",
    source: `
      import { PriceRepository } from "@shop/pricing/internal/PriceRepository"
      export const stolen = PriceRepository
    `
  },
  {
    name: "Catalog's public barrel does not export its repository",
    project: "packages/catalog", diagnostic: "TS2305",
    source: `
      import { ProductRepository } from "@shop/catalog"
      export const stolen = ProductRepository
    `
  },
  {
    name: "Catalog package exports reject a private named subpath",
    project: "packages/catalog", diagnostic: "TS2307",
    source: `
      import { ProductRepository } from "@shop/catalog/internal/ProductRepository"
      export const stolen = ProductRepository
    `
  }
]

try {
  for (const [index, example] of cases.entries()) {
    const fixture = join(root, example.project, "src/_boundary.invalid.ts")
    let created = false
    try {
      // Exclusive creation prevents overwriting an existing user file.
      await writeFile(fixture, example.source, { flag: "wx" })
      created = true
      const result = spawnSync(process.execPath, [
        compiler, "-p", join(root, example.project), "--noEmit",
        "--tsBuildInfoFile", join(scratch, `${index}.tsbuildinfo`)
      ], { cwd: root, encoding: "utf8", timeout: 20_000 })
      if (result.error) throw result.error
      const output = result.stdout + result.stderr
      assert.notEqual(result.status, 0, `${example.name}: unexpectedly compiled`)
      assert.ok(output.includes(`error ${example.diagnostic}:`), output)
      console.log(`PASS ${example.name} (${example.diagnostic})`)
      console.log(output.split("\n").find((line) => line.includes(example.diagnostic)))
    } finally {
      if (created) await rm(fixture, { force: true })
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true })
}
