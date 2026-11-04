import { Context, Effect, Layer } from "effect"

// Exported for use INSIDE this package. Absent from its public barrel.
export class InventoryRepository extends Context.Service<InventoryRepository, {
  readonly quantity: (productId: string) => Effect.Effect<number>
}>()("@shop/logistics/internal/InventoryRepository") {}

export const InventoryRepositoryLive = Layer.succeed(InventoryRepository, {
  quantity: (productId) => Effect.succeed(productId === "p-1" ? 12 : 0)
})
