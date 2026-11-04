import { Effect, Layer } from "effect"
import { Pricing, PriceUnavailable } from "../Pricing.js"
import { PriceRepository, PriceRepositoryLive } from "./PriceRepository.js"

export const PricingModule: Layer.Layer<Pricing> = Layer.effect(
  Pricing,
  Effect.gen(function* () {
    const prices = yield* PriceRepository
    return {
      getPrice: (productId) => Effect.gen(function* () {
        const price = yield* prices.find(productId)
        return price ?? (yield* Effect.fail(new PriceUnavailable(productId)))
      })
    }
  })
).pipe(Layer.provide(PriceRepositoryLive))
