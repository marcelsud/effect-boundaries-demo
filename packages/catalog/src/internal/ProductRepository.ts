import { Context, Effect, Layer } from "effect"

export class ProductRepository extends Context.Service<ProductRepository, {
  readonly find: (productId: string) => Effect.Effect<
    { readonly id: string; readonly name: string } | undefined
  >
}>()("@shop/catalog/internal/ProductRepository") {}

export const ProductRepositoryLive = Layer.succeed(ProductRepository, {
  find: (productId) => Effect.succeed(
    productId === "p-1" ? { id: "p-1", name: "Keyboard" } : undefined
  )
})
