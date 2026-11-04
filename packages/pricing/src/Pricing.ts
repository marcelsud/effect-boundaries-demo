import { Context, Effect } from "effect"

export interface Price {
  readonly amountCents: number
  readonly currency: string
}

export class PriceUnavailable extends Error {
  readonly _tag = "PriceUnavailable"
  constructor(readonly productId: string) {
    super(`Price not found: ${productId}`)
  }
}

export class Pricing extends Context.Service<Pricing, {
  readonly getPrice: (productId: string) => Effect.Effect<Price, PriceUnavailable>
}>()("@shop/Pricing") {}
