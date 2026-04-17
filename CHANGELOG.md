# [2.0.0](https://github.com/alexasomba/better-auth-paystack/compare/v1.2.1...v2.0.0) (2026-04-17)

### Features

- migrate to pnpm workspace catalog + vite+ toolchain ([1ea0ac6](https://github.com/alexasomba/better-auth-paystack/commit/1ea0ac6d5d01c859ba20a8b6a4cb09fc489569f4))
- stabilization for paystack-node v1.9.1 and zero-error production build ([bd04514](https://github.com/alexasomba/better-auth-paystack/commit/bd04514b8f041ff346338fe9307779d714652431))
- absolute zero-error and zero-warning stabilization for src/ ([5ab7345](https://github.com/alexasomba/better-auth-paystack/commit/5ab73456d2994f38695029e0617e467645103454))
- stabilize tanstack example and align better-auth dependencies ([f43fea1](https://github.com/alexasomba/better-auth-paystack/commit/f43fea11762198084a44f434778119859f776269))

### Refactors

- align Paystack SDK calls with v2 positional arguments structure ([1c809e8](https://github.com/alexasomba/better-auth-paystack/commit/1c809e8d5d01c859ba20a8b6a4cb09fc489569f4))

### Documentation

- align AGENTS.md with Vite+ toolchain and clarify git protocol ([b1b4fa1](https://github.com/alexasomba/better-auth-paystack/commit/b1b4fa11762198084a44f434778119859f776269))
- streamline AGENTS.md and stabilize test suite types ([300d0fa](https://github.com/alexasomba/better-auth-paystack/commit/300d0fa1762198084a44f434778119859f776269))

### Miscellaneous Chores

- stabilize paystack routes and integration tests ([c8b1bf7](https://github.com/alexasomba/better-auth-paystack/commit/c8b1bf71762198084a44f434778119859f776269))
- remove debug artifacts (eslint reports, fix-any.js) ([306dc86](https://github.com/alexasomba/better-auth-paystack/commit/306dc860dd281c933ac9dafe9666337b0346bcd6))
- migrate to vite+ and install tanstack intent ([6fa5e4a](https://github.com/alexasomba/better-auth-paystack/commit/6fa5e4a1762198084a44f434778119859f776269))

# [1.2.1](https://github.com/alexasomba/better-auth-paystack/compare/v1.2.0...v1.2.1) (2026-03-15)

### Features

- v1.2.1 — type safety improvements, lint fixes, remove build artifacts from src ([26dd656](https://github.com/alexasomba/better-auth-paystack/commit/26dd656297d3330df3e5427f973dfee4248032c4))

### Bug Fixes

- Fix/client type compatibility ([54b4117](https://github.com/alexasomba/better-auth-paystack/commit/54b411762198084a44f434778119859f776269))

# [1.2.0](https://github.com/alexasomba/better-auth-paystack/compare/v1.1.2...v1.2.0) (2026-03-01)

### Bug Fixes

- cleanup build artifacts and update config to prevent emission ([a39ac73](https://github.com/alexasomba/better-auth-paystack/commit/a39ac73514ead25347cebbcc59f1abd2def64087))
- **lint:** fix indentation and style issues to unblock CI ([a9f9d98](https://github.com/alexasomba/better-auth-paystack/commit/a9f9d9854a9ad90de47bc213228b06f716a1d7a7))
- remove unused imports causing tanstack example type errors ([e275e1a](https://github.com/alexasomba/better-auth-paystack/commit/e275e1aca4750e02fc8f76c55ced418acea80b5e))
- resolve double-billing in seat calculation ([565faf5](https://github.com/alexasomba/better-auth-paystack/commit/565faf591a109f0048c04ecb5a1e58725b927d59))

### Features

- achieve 100% feature parity with stripe plugin ([acc7cac](https://github.com/alexasomba/better-auth-paystack/commit/acc7cac5301524f1515de6899a436e333aa0fe14))
- better-auth 1.5.0 compatibility fixes ([1778d59](https://github.com/alexasomba/better-auth-paystack/commit/1778d5930a95e88f7b69733d3fddb45be204e56a))
- implement seat-based billing, scheduled changes, and Better Auth 1.5.0 compatibility ([451cbdd](https://github.com/alexasomba/better-auth-paystack/commit/451cbdd30d359f8c8c4bf1560483bf50a1567c8a))
- integrate `@better-auth/infra` dash plugin. ([fd48fbb](https://github.com/alexasomba/better-auth-paystack/commit/fd48fbb6b03867604ece434a96875dad412c8af3))
- **paystack:** implement prorateAndCharge for mid-cycle seat increases ([b7c061d](https://github.com/alexasomba/better-auth-paystack/commit/b7c061dc2b44fa88e6b1c9b8bcb51ac8cac892b0))

## [1.1.2](https://github.com/alexasomba/better-auth-paystack/compare/v1.1.1...v1.1.2) (2026-02-26)

### Bug Fixes

- **types:** resolve webhook payload typecheck errors and test failures (#81) ([d03f2d2](https://github.com/alexasomba/better-auth-paystack/commit/d03f2d2b4e1c46356992d80eb0aea4fc47ae4235))

## [1.1.1](https://github.com/alexasomba/better-auth-paystack/compare/v1.1.0...v1.1.1) (2026-02-24)

### Bug Fixes

- resolve endpoint path conflict and properly implement cancelAtPeriodEnd logic ([94aea7e](https://github.com/alexasomba/better-auth-paystack/commit/94aea7e533c8f8c9a41a58a5d3df137c0c3c268c))

# [1.1.0](https://github.com/alexasomba/better-auth-paystack/compare/v1.0.4...v1.1.0) (2026-02-23)

### Bug Fixes

- **examples:** ensure fixed price for native plans in UI ([7d499b8](https://github.com/alexasomba/better-auth-paystack/commit/7d499b89aab26087984b6706261652d11cfcae00))
- resolve issue #68 by passing raw metadata object for customer creation ([2999fd2](https://github.com/alexasomba/better-auth-paystack/commit/2999fd2ec5c8819b8450daa5ce811155acba6a3e))

### Features

- Add database indexes and unique constraints to schema models and document them in the README. ([f0db346](https://github.com/alexasomba/better-auth-paystack/commit/f0db346b1a9b36ae07dde75ad017e61954c36d7c))
- add optional `planCode` property to `Product` interface ([20f5873](https://github.com/alexasomba/better-auth-paystack/commit/20f5873b14fc160c09abada5d40e2d071a3d97e0))
- **examples:** distinguish local vs native plans in UI ([aac3003](https://github.com/alexasomba/better-auth-paystack/commit/aac3003dd21a045ce24eb1480e8d739844dc8733))
- implement deep typesafety with generics for metadata and limits ([e0eb8ac](https://github.com/alexasomba/better-auth-paystack/commit/e0eb8ac22738c2dcd273c5461f3bc67af2133c5e))
- improve typesafety for webhook payloads (#67) ([fec03da](https://github.com/alexasomba/better-auth-paystack/commit/fec03da2c23fdd35f66058d4d6f6a010ad44557a))
- **products:** implement product management and syncing #66 ([20f3186](https://github.com/alexasomba/better-auth-paystack/commit/20f31861ad629dcbe74c8fe1e47d882ca5af0c64))
- sync product quantity from Paystack API on charge.success webhook ([d35c243](https://github.com/alexasomba/better-auth-paystack/commit/d35c2438ab275a73a8aff82509bdfc6ce0f0117a))

## [1.0.3](https://github.com/alexasomba/better-auth-paystack/compare/v1.0.0...v1.0.3) (2026-02-11)

### Bug Fixes

- **paystack:** implement cancelAtPeriodEnd logic for subscriptions ([72720cc](https://github.com/alexasomba/better-auth-paystack/commit/72720cc14b258a14b4ca295d555f745b753b8373)), closes #60

### Features

- Add new tests, introduce `PaystackCurrency` type, implement minimum amount validation, and update subscription API definitions. ([97a4574](https://github.com/alexasomba/better-auth-paystack/commit/97a4574474888e339eb2103c85366490d7c7e9c7))
- Add Paystack transaction charge authorization, update types and schema, improve ESLint configuration, and expand test coverage. ([e24202e](https://github.com/alexasomba/better-auth-paystack/commit/e24202e19b200fb55b111cf51dfa094325427ff9))
- Add support for Paystack 'cancel at period end' functionality by tracking subscription period end dates and adjusting cancellation status updates. ([c2586b1](https://github.com/alexasomba/better-auth-paystack/commit/c2586b1e5b3d2f4ca787519952a7c4baf753acbf))
- Update package metadata, and remove outdated utility comments. ([4c13ec6](https://github.com/alexasomba/better-auth-paystack/commit/4c13ec63dbd8a0777e04dc2ed37811ea0c195c25))
