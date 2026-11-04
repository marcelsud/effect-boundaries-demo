import { Effect, Layer } from "effect"
import { Logistics } from "../Logistics.js"
import {
  InventoryRepository, InventoryRepositoryLive
} from "./InventoryRepository.js"

export const LogisticsModule: Layer.Layer<Logistics> = Layer.effect(
  Logistics,
  Effect.gen(function* () {
    const inventory = yield* InventoryRepository
    return { getAvailability: inventory.quantity }
  })
).pipe(
  // Consume the private provider; expose only Logistics.
  Layer.provide(InventoryRepositoryLive)
)
