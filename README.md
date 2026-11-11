# Effect Service Boundaries Demo

This repository brings the Nx and Turborepo versions of the demo together. The application and domain packages live once in `apps/` and `packages/`. The repository root is the Bun workspace, so both tools discover the real shared packages and check their source files. `nx/` and `turborepo/` hold their own tool dependencies, lockfiles, configs, and command wrappers.

The demo shows how Effect services define clear boundaries between Catalog, Pricing, and Logistics. Catalog composes the other services through their public interfaces, while repository and implementation details stay inside their owning packages. Each package exports only its public entry point (the service, DTOs/errors, and implementation Layer). The boundary tools reject imports that cross those public interfaces.

```text
packages/catalog       @shop/catalog       Catalog, CatalogLive
packages/logistics     @shop/logistics     Logistics, LogisticsLive
packages/pricing       @shop/pricing       Pricing, PricingLive
apps/demo              @shop/demo          Application and runtime assertions
nx/                    Nx config, lockfile, and command wrappers
turborepo/             Turborepo config, lockfile, and command wrappers
```

## Install

Requires Node.js 24+ and Bun 1.4.4. From the repository root, install the shared dependencies and each tool's runner:

```sh
bun install --frozen-lockfile
cd nx && bun install --frozen-lockfile && cd ..
cd turborepo && bun install --frozen-lockfile && cd ..
```

Or run `bun run install:all` once, then use `--frozen-lockfile` in CI. `bun run setup:hooks` points Git at the repo-root pre-commit hook, which runs `check` for both tools.

## Nx

```sh
cd nx
bun run lint
bun run build
bun run check
bun run demo
bun run format:check
```

`lint` runs Nx's ESLint module-boundary rule. `build` also depends on lint and upstream builds. `check` builds the projects and runs the demo assertions. `demo` prints the Keyboard product JSON. Use `bun run graph` to inspect the Nx project graph.

## Turborepo

```sh
cd turborepo
bun run boundaries
bun run build
bun run check
bun run demo
bun run format:check
```

`boundaries` runs Turborepo's dependency boundary checks. `build` depends on those checks and upstream builds. `check` builds the projects and runs the demo assertions. `demo` prints the Keyboard product JSON. Use `bun run graph` to render the task graph.

The application prints:

```json
{
  "id": "p-1",
  "name": "Keyboard",
  "availableQuantity": 12,
  "price": { "amountCents": 19900, "currency": "BRL" }
}
```

It also checks missing product/price failures, zero inventory for an unknown product, and related schema/error assertions. Those checks live in the application, not a custom test runner.

Shared TypeScript project references and compiler settings are at the repository root. `preserveSymlinks` keeps module resolution within the workspace while the tool folders use whole-directory links to `packages/` and `apps/`.

The previous version on `main` used a custom Oxlint setup and scripts. That version remains in Git history; this merge replaces its source layout with the evolved shared application used by both tool variants.
