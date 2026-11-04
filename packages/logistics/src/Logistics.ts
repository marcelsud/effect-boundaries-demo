import { Context, Effect } from "effect"

export class Logistics extends Context.Service<Logistics, {
  readonly getAvailability: (productId: string) => Effect.Effect<number>
}>()("@shop/Logistics") {}
