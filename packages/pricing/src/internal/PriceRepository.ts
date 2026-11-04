import { Context, Effect, Layer } from "effect"
import type { Price } from "../Pricing.js"

export class PriceRepository extends Context.Service<PriceRepository, {
  readonly find: (productId: string) => Effect.Effect<Price | undefined>
}>()("@shop/pricing/internal/PriceRepository") {}

export const PriceRepositoryLive = Layer.succeed(PriceRepository, {
  find: (productId) => Effect.succeed(
    productId === "p-1" ? { amountCents: 19900, currency: "BRL" } : undefined
  )
})
