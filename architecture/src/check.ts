import type { Layer } from "effect"
import { CatalogLive, type Catalog } from "@shop/catalog"
import { LogisticsLive, type Logistics } from "@shop/logistics"
import { PricingLive, type Pricing } from "@shop/pricing"

// Centrally owned policy. Teams cannot widen this by changing their own Layer
// annotations. Construction errors are unrestricted; input services are not.
export type ModulePolicy = {
  readonly catalog: Layer.Layer<Catalog, unknown, Logistics | Pricing>
  readonly logistics: Layer.Layer<Logistics, unknown, never>
  readonly pricing: Layer.Layer<Pricing, unknown, never>
}

// Check the modules' actual exported types. `satisfies` preserves their types
// and reports any requirements exceeding the central policy during tsc -b.
// This file is a build check using only the same public entry points as callers.
export const modules = {
  catalog: CatalogLive,
  logistics: LogisticsLive,
  pricing: PricingLive
} satisfies ModulePolicy
