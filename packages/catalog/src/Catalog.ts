import { Context, Effect } from "effect"
import type { Price } from "@shop/pricing"

export interface Product {
  readonly id: string
  readonly name: string
  readonly availableQuantity: number
  readonly price: Price
}

export class ProductUnavailable extends Error {
  readonly _tag = "ProductUnavailable"
  readonly productId: string
  constructor({ productId, message }: { productId: string; message: string }) {
    super(message)
    this.productId = productId
  }
}

export class Catalog extends Context.Service<Catalog, {
  readonly getProduct: (productId: string) => Effect.Effect<Product, ProductUnavailable>
}>()("@shop/Catalog") {}
