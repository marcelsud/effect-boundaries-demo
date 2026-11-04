import { Effect, Layer } from "effect"
import { Catalog, ProductUnavailable } from "../Catalog.js"
import { Logistics } from "@shop/logistics"
import { Pricing } from "@shop/pricing"
import {
  ProductRepository, ProductRepositoryLive
} from "./ProductRepository.js"

// The third type argument is Catalog's allowed external provider requirement.
export const CatalogModule: Layer.Layer<Catalog, never, Logistics | Pricing> = Layer.effect(
  Catalog,
  Effect.gen(function* () {
    const products = yield* ProductRepository
    const logistics = yield* Logistics
    const pricing = yield* Pricing

    return {
      getProduct: (productId) => Effect.gen(function* () {
        const product = yield* products.find(productId)
        if (!product) {
          return yield* Effect.fail(new ProductUnavailable({
            productId, message: "Product not found"
          }))
        }
        const availableQuantity = yield* logistics.getAvailability(productId)
        const price = yield* pricing.getPrice(productId).pipe(
          Effect.mapError((error) => new ProductUnavailable({
            productId, message: error.message
          }))
        )
        return { ...product, availableQuantity, price }
      })
    }
  })
).pipe(Layer.provide(ProductRepositoryLive))
