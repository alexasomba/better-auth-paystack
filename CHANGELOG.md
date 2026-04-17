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

## [2.1.0](https://github.com/alexasomba/better-auth-paystack/compare/better-auth-paystack-v2.0.0...better-auth-paystack-v2.1.0) (2026-04-17)


### Features

* achieve 100% feature parity with stripe plugin ([acc7cac](https://github.com/alexasomba/better-auth-paystack/commit/acc7cac5301524f1515de6899a436e333aa0fe14))
* Add advanced IP address and rate limiting configurations, and `NEXT_PUBLIC_BETTER_AUTH_URL` variable. ([1f61f5d](https://github.com/alexasomba/better-auth-paystack/commit/1f61f5d547488963b53146d3eaa32126408fff5d))
* Add advanced IP address and rate limiting configurations, and `NEXT_PUBLIC_BETTER_AUTH_URL` variable. ([3665497](https://github.com/alexasomba/better-auth-paystack/commit/366549741689b778ccc07b4117bb44c3e592c81a))
* Add authorization checks to `verifyTransaction` and refine `referenceId` determination based on transaction records or session. ([eb88b05](https://github.com/alexasomba/better-auth-paystack/commit/eb88b058bd29e281f57594dfc2e730af6972f424))
* Add Better Auth secret to example environment variables and Better Auth URL to Wrangler configuration. ([5c747ba](https://github.com/alexasomba/better-auth-paystack/commit/5c747ba2fe86f26b37fcb1cebece2c5ebb1ea2a5))
* Add Better Auth secret to example environment variables and Better Auth URL to Wrangler configuration. ([d027719](https://github.com/alexasomba/better-auth-paystack/commit/d027719c0864f181117bda32bd1840f36040b84e))
* Add database indexes and unique constraints to schema models and document them in the README. ([f0db346](https://github.com/alexasomba/better-auth-paystack/commit/f0db346b1a9b36ae07dde75ad017e61954c36d7c))
* Add new tests, introduce `PaystackCurrency` type, implement minimum amount validation, and update subscription API definitions. ([97a4574](https://github.com/alexasomba/better-auth-paystack/commit/97a4574474888e339eb2103c85366490d7c7e9c7))
* add optional `planCode` property to `Product` interface ([20f5873](https://github.com/alexasomba/better-auth-paystack/commit/20f5873b14fc160c09abada5d40e2d071a3d97e0))
* Add Paystack plugin tests, standardize environment variables, and improve example configurations. ([30f0b1c](https://github.com/alexasomba/better-auth-paystack/commit/30f0b1cd86f2804fe293046337ffb372e4d9c488))
* Add Paystack plugin tests, standardize environment variables, and improve example configurations. ([1a2c7da](https://github.com/alexasomba/better-auth-paystack/commit/1a2c7da5f7e11fe2767f4506f0d59d73ab53adda))
* Add Paystack transaction charge authorization, update types and schema, improve ESLint configuration, and expand test coverage. ([e24202e](https://github.com/alexasomba/better-auth-paystack/commit/e24202e19b200fb55b111cf51dfa094325427ff9))
* Add support for Paystack 'cancel at period end' functionality by tracking subscription period end dates and adjusting cancellation status updates. ([c2586b1](https://github.com/alexasomba/better-auth-paystack/commit/c2586b1e5b3d2f4ca787519952a7c4baf753acbf))
* add TypeScript configuration and Vite setup for TanStack example ([403aa78](https://github.com/alexasomba/better-auth-paystack/commit/403aa78fb9162961bbffb8115ff46512f520c629))
* add Vite SSR configuration to prevent externalizing `@alexasomba/better-auth-paystack`. ([05d535f](https://github.com/alexasomba/better-auth-paystack/commit/05d535fcb5bce2359ef2b3f7b2c051368b42fc82))
* Add Vitest unit and Playwright E2E tests to the Tanstack example, and enhance Paystack plugin with subscription webhook tests. ([b0d1bec](https://github.com/alexasomba/better-auth-paystack/commit/b0d1becc8738109543596400d5db4cbd968e582a))
* better-auth 1.5.0 compatibility fixes ([1778d59](https://github.com/alexasomba/better-auth-paystack/commit/1778d5930a95e88f7b69733d3fddb45be204e56a))
* Configure advanced IP address detection and extensive rate limiting for authentication and Paystack routes. ([90158fe](https://github.com/alexasomba/better-auth-paystack/commit/90158fe4db0d09ee9e8455018cdb564b43fcf79c))
* Configure advanced IP address detection and extensive rate limiting for authentication and Paystack routes. ([a324799](https://github.com/alexasomba/better-auth-paystack/commit/a324799dbe8f313b1105b4766c5a0be936386ca5))
* enhance Paystack integration with improved type definitions and options ([2b04501](https://github.com/alexasomba/better-auth-paystack/commit/2b0450116a8ff74e67687750a1a476cf16a1ba75))
* Enhance Paystack integration with subscription lifecycle management ([6f29136](https://github.com/alexasomba/better-auth-paystack/commit/6f291368eb2e1bcb5c0035da49fecc287becd1dc))
* **examples:** distinguish local vs native plans in UI ([aac3003](https://github.com/alexasomba/better-auth-paystack/commit/aac3003dd21a045ce24eb1480e8d739844dc8733))
* implement deep typesafety with generics for metadata and limits ([e0eb8ac](https://github.com/alexasomba/better-auth-paystack/commit/e0eb8ac22738c2dcd273c5461f3bc67af2133c5e))
* implement Paystack subscription management endpoints and schema ([0d86347](https://github.com/alexasomba/better-auth-paystack/commit/0d8634757fa722a5c77695f71b5c7268e2f60177))
* implement seat-based billing, scheduled changes, and Better Auth 1.5.0 compatibility ([451cbdd](https://github.com/alexasomba/better-auth-paystack/commit/451cbdd30d359f8c8c4bf1560483bf50a1567c8a))
* improve typesafety for webhook payloads ([#67](https://github.com/alexasomba/better-auth-paystack/issues/67)) ([fec03da](https://github.com/alexasomba/better-auth-paystack/commit/fec03da2c23fdd35f66058d4d6f6a010ad44557a))
* integrate `@better-auth/infra` dash plugin. ([fd48fbb](https://github.com/alexasomba/better-auth-paystack/commit/fd48fbb6b03867604ece434a96875dad412c8af3))
* integrate Better Auth with Paystack in Hono and Next.js examples ([7da26fe](https://github.com/alexasomba/better-auth-paystack/commit/7da26fe5666d5e379152b6f6d60a6780f1c8f5a4))
* Introduce Paystack customer creation for organizations, implement subscription free trials with eligibility checks, and add new subscription lifecycle hooks. ([de8f0e7](https://github.com/alexasomba/better-auth-paystack/commit/de8f0e7c5dc8db10a0c3b5cf222d4b53ad745e8a))
* Introduce Paystack SDK updates, add limits module, enhance Next.js and Tanstack examples with new auth and billing features, and expand documentation. ([1c1d88b](https://github.com/alexasomba/better-auth-paystack/commit/1c1d88b29a94677624840259d444d8b53801835f))
* Local Subscriptions, Multi-Currency Support & Validation (v1.0.3) ([8ae609c](https://github.com/alexasomba/better-auth-paystack/commit/8ae609c69be5e75fc0db034ae4bb5d410b4ffd47))
* **nextjs:** add payment integration tests and rename subscription list endpoint ([88a8a4b](https://github.com/alexasomba/better-auth-paystack/commit/88a8a4b39cf154b078bb7fd363aaa374218e45fe))
* **paystack:** implement prorateAndCharge for mid-cycle seat increases ([b7c061d](https://github.com/alexasomba/better-auth-paystack/commit/b7c061dc2b44fa88e6b1c9b8bcb51ac8cac892b0))
* **products:** implement product management and syncing [#66](https://github.com/alexasomba/better-auth-paystack/issues/66) ([20f3186](https://github.com/alexasomba/better-auth-paystack/commit/20f31861ad629dcbe74c8fe1e47d882ca5af0c64))
* re-apply missing v2.0.0 features (IP whitelisting) ([#104](https://github.com/alexasomba/better-auth-paystack/issues/104)) ([647d642](https://github.com/alexasomba/better-auth-paystack/commit/647d642c6ab246b7618e3a017c5ea1e930a7cfaf))
* resolve IP whitelisting availability (Issue [#102](https://github.com/alexasomba/better-auth-paystack/issues/102)) ([647d642](https://github.com/alexasomba/better-auth-paystack/commit/647d642c6ab246b7618e3a017c5ea1e930a7cfaf))
* sync product quantity from Paystack API on charge.success webhook ([d35c243](https://github.com/alexasomba/better-auth-paystack/commit/d35c2438ab275a73a8aff82509bdfc6ce0f0117a))
* typed Paystack transaction APIs ([ec27a86](https://github.com/alexasomba/better-auth-paystack/commit/ec27a869bc965f0d0115374187ff8cb03cd95fec))
* Update Better Auth base URL to gittech.workers.dev and enhance client-side URL resolution logic. ([66385bf](https://github.com/alexasomba/better-auth-paystack/commit/66385bf82d69d25e62b07568ee515b2f749ac06c))
* update dependencies and enhance Paystack client type definitions ([774193b](https://github.com/alexasomba/better-auth-paystack/commit/774193b6cbd62e1148b6361f455179cacf804f18))
* Update package metadata, and remove outdated utility comments. ([4c13ec6](https://github.com/alexasomba/better-auth-paystack/commit/4c13ec63dbd8a0777e04dc2ed37811ea0c195c25))
* update Paystack subscription handling to allow optional emailToken and referenceId ([6de64e2](https://github.com/alexasomba/better-auth-paystack/commit/6de64e21523e82c4f8a24437c3d44598c4eddd9d))
* v2.0.0 — Vite+ Toolchain, Release Please Automation & Workspace Stabilization ([#103](https://github.com/alexasomba/better-auth-paystack/issues/103)) ([1da50c4](https://github.com/alexasomba/better-auth-paystack/commit/1da50c4332fbaaed38767700a9338a361e2bae8f))


### Bug Fixes

* accept optional hook context ([#8](https://github.com/alexasomba/better-auth-paystack/issues/8)) ([e64a1d6](https://github.com/alexasomba/better-auth-paystack/commit/e64a1d6db60f54567244fa809df2c981043af555))
* **ci:** use actions/setup-node@v4 in release workflow ([#16](https://github.com/alexasomba/better-auth-paystack/issues/16)) ([be308f4](https://github.com/alexasomba/better-auth-paystack/commit/be308f4b3108b369b4851048196f7b57631fd295))
* cleanup build artifacts and update config to prevent emission ([a39ac73](https://github.com/alexasomba/better-auth-paystack/commit/a39ac73514ead25347cebbcc59f1abd2def64087))
* **examples:** ensure fixed price for native plans in UI ([7d499b8](https://github.com/alexasomba/better-auth-paystack/commit/7d499b89aab26087984b6706261652d11cfcae00))
* exclude examples from root test coverage ([e99598f](https://github.com/alexasomba/better-auth-paystack/commit/e99598f5d3800d313443c990d70b6e740fcfc5b2))
* explicit exports in package.json and robust test env mocking ([b95974b](https://github.com/alexasomba/better-auth-paystack/commit/b95974b131a17ea7174c1ac9a1d3311605d75f92))
* explicitly cast transaction amount to string to prevent SDK type errors (v0.2.1) ([0a29869](https://github.com/alexasomba/better-auth-paystack/commit/0a29869841817027fc44869262140d254d613493))
* Improve Paystack SDK error handling and refine seat limit checks, alongside general code and build system updates. in preparation for v1 release. ([e937280](https://github.com/alexasomba/better-auth-paystack/commit/e93728043a296132f147675acfaf16b177c635bd))
* Increase test timeouts in `paystack.test.js` to 30 seconds. ([28f5402](https://github.com/alexasomba/better-auth-paystack/commit/28f540230404834f51a07903587de315a3551d71))
* **lint:** fix indentation and style issues to unblock CI ([a9f9d98](https://github.com/alexasomba/better-auth-paystack/commit/a9f9d9854a9ad90de47bc213228b06f716a1d7a7))
* **nextjs:** replace explicit any with unknown in test catch blocks ([6612d55](https://github.com/alexasomba/better-auth-paystack/commit/6612d55129632cded5c5ed5b94cb84a9103c2eda))
* **paystack:** implement cancel at period end logic ([4cec096](https://github.com/alexasomba/better-auth-paystack/commit/4cec0966cc7367681dc2546e7180376914f9f32d))
* **paystack:** implement cancelAtPeriodEnd logic for subscriptions ([72720cc](https://github.com/alexasomba/better-auth-paystack/commit/72720cc14b258a14b4ca295d555f745b753b8373)), closes [#60](https://github.com/alexasomba/better-auth-paystack/issues/60)
* remove unused imports causing tanstack example type errors ([e275e1a](https://github.com/alexasomba/better-auth-paystack/commit/e275e1aca4750e02fc8f76c55ced418acea80b5e))
* resolve double-billing in seat calculation ([565faf5](https://github.com/alexasomba/better-auth-paystack/commit/565faf591a109f0048c04ecb5a1e58725b927d59))
* resolve endpoint path conflict and properly implement cancelAtPeriodEnd logic ([94aea7e](https://github.com/alexasomba/better-auth-paystack/commit/94aea7e533c8f8c9a41a58a5d3df137c0c3c268c))
* resolve issue [#68](https://github.com/alexasomba/better-auth-paystack/issues/68) by passing raw metadata object for customer creation ([2999fd2](https://github.com/alexasomba/better-auth-paystack/commit/2999fd2ec5c8819b8450daa5ce811155acba6a3e))
* standardize quotes in release workflow configuration ([8d66346](https://github.com/alexasomba/better-auth-paystack/commit/8d66346b9bf9acb524b442b59293c56614b0ab01))
* **types:** resolve webhook payload typecheck errors and test failures ([#81](https://github.com/alexasomba/better-auth-paystack/issues/81)) ([d03f2d2](https://github.com/alexasomba/better-auth-paystack/commit/d03f2d2b4e1c46356992d80eb0aea4fc47ae4235))
* update background gradient classes for address and simple forms ([cfdfdf3](https://github.com/alexasomba/better-auth-paystack/commit/cfdfdf38d941c515094dc5316d6e35c14576bed4))


### Miscellaneous Chores

* Add observability logging configuration to wrangler.jsonc. ([0377c9b](https://github.com/alexasomba/better-auth-paystack/commit/0377c9ba2877564f59e05994e945dffcd4db0f55))
* bump version to 1.1.0 ([abd9ffa](https://github.com/alexasomba/better-auth-paystack/commit/abd9ffac3719d3b0cac69d6172ae094ddd973a14))
* **ci:** add CI workflows and Dependabot ([#2](https://github.com/alexasomba/better-auth-paystack/issues/2)) ([93f60af](https://github.com/alexasomba/better-auth-paystack/commit/93f60af6fa649dca0aa2cda172175d84ef56a7cd))
* **ci:** create GitHub Release on tag ([be31800](https://github.com/alexasomba/better-auth-paystack/commit/be3180029f4c5e53f9da42962454389382db05ca))
* **deps-dev:** bump @vitest/ui from 3.2.4 to 4.1.0 ([#95](https://github.com/alexasomba/better-auth-paystack/issues/95)) ([bc81133](https://github.com/alexasomba/better-auth-paystack/commit/bc811337957202242e33fe193b37b1e556f22281))
* **deps-dev:** bump typescript-eslint from 8.56.1 to 8.57.1 ([#92](https://github.com/alexasomba/better-auth-paystack/issues/92)) ([f739202](https://github.com/alexasomba/better-auth-paystack/commit/f739202fd41789d540579a9678071bf0573ea637))
* **deps:** bump @opennextjs/cloudflare from 1.16.1 to 1.16.2 ([4f18183](https://github.com/alexasomba/better-auth-paystack/commit/4f181835cbb915cf937e3bf30ba76816f3daa043))
* **deps:** bump @tanstack/ai-react from 0.0.3 to 0.2.0 ([#19](https://github.com/alexasomba/better-auth-paystack/issues/19)) ([ca3bdb8](https://github.com/alexasomba/better-auth-paystack/commit/ca3bdb8739bee704189196f61b1e27385c485cc0))
* **deps:** bump @tanstack/react-form from 1.27.5 to 1.27.6 ([#21](https://github.com/alexasomba/better-auth-paystack/issues/21)) ([7378093](https://github.com/alexasomba/better-auth-paystack/commit/73780934335ab31e3635afef0a30630d17ccbe65))
* **deps:** bump @tanstack/router-plugin from 1.141.7 to 1.143.3 ([#20](https://github.com/alexasomba/better-auth-paystack/issues/20)) ([c4788fd](https://github.com/alexasomba/better-auth-paystack/commit/c4788fd34bb5edd5e962b9ff61ada15fe4acfa45))
* **dev:** add better-auth dev deps for CI ([de2c157](https://github.com/alexasomba/better-auth-paystack/commit/de2c1576445cebc8a387a2ba873808e232b1409b))
* Enable observability logs and traces in wrangler configuration. ([620144b](https://github.com/alexasomba/better-auth-paystack/commit/620144bf2328f0af1e90732efe67d4d6b318113f))
* **examples:** update tanstack example to showcase scheduleAtPeriodEnd and seatAmount ([6036942](https://github.com/alexasomba/better-auth-paystack/commit/603694262eea0bd438836364fac4074c74a8d417))
* increase test timeouts for CI coverage stability ([040b295](https://github.com/alexasomba/better-auth-paystack/commit/040b29595ccf8368f4725e21ad1f6e23d6f446c6))
* release v0.1.0 ([c9aa901](https://github.com/alexasomba/better-auth-paystack/commit/c9aa901e5f6f79a2134c4e4c03c008855da93c00))
* release v0.1.1 ([823dd7d](https://github.com/alexasomba/better-auth-paystack/commit/823dd7d7c9baaad9345d1bf5489f120b2be93252))
* release v0.2.2 ([581f9cd](https://github.com/alexasomba/better-auth-paystack/commit/581f9cdf642c03b1b9b8243df01355c7e90ab903))
* release v1.0.0 with expanded metadata and funding ([e137f94](https://github.com/alexasomba/better-auth-paystack/commit/e137f9417b5190249d23b6e78553c44365880a9d))
* release v1.0.0-rc.1 ([0a7f2b5](https://github.com/alexasomba/better-auth-paystack/commit/0a7f2b52f65ef83c243423d35ac53928a38656e5))
* release v1.0.0-rc.2 ([d1dff76](https://github.com/alexasomba/better-auth-paystack/commit/d1dff7628da71db854806ccb765e6f2656cb185b))
* release v1.0.0-rc.3 ([c315fd8](https://github.com/alexasomba/better-auth-paystack/commit/c315fd88e49694ece51bd49d54ba768ebcf7748a))
* release v1.0.3 ([45bf71c](https://github.com/alexasomba/better-auth-paystack/commit/45bf71c383585bce5f3e54bae2b5061e40969ef3))
* release v1.0.4 ([f582e60](https://github.com/alexasomba/better-auth-paystack/commit/f582e601edb14594d99d06a082a82727fae52be6))
* release v1.1.2 ([4a6bded](https://github.com/alexasomba/better-auth-paystack/commit/4a6bded2fccc3bc5aaa1e2d67883592af6f8e405))
* release v1.2.0 ([3b4fc26](https://github.com/alexasomba/better-auth-paystack/commit/3b4fc265c8a96657e4c719d0e55b59e2af10dab5))
* **release:** add release workflow + community plugin entry ([530148d](https://github.com/alexasomba/better-auth-paystack/commit/530148db8909779836c7d11b6424c70263eda3dd))
* Remove `examples/tanstack` from the `eslint` linting scope. ([ae9dbca](https://github.com/alexasomba/better-auth-paystack/commit/ae9dbca48c968f7c15cb40b143e990e2e81b62f8))
* remove accidental test artifact ([874034e](https://github.com/alexasomba/better-auth-paystack/commit/874034eed8965ffe91489db952a25d5451e02cf4))
* remove npm publish workflow from GitHub Actions ([861a6cf](https://github.com/alexasomba/better-auth-paystack/commit/861a6cf274faff8a940c6a5c0667c0af0ce7f160))
* setup husky pre-commit hooks and nextjs auth tests ([73faa78](https://github.com/alexasomba/better-auth-paystack/commit/73faa78933e6fd62a333474433a2c9f0c85cc3a6))
* update deprecated release-please action ([a0e23b0](https://github.com/alexasomba/better-auth-paystack/commit/a0e23b052d7a8d7b9dd4095dc0558e670da8c1a1))
* update deprecated release-please action ([#107](https://github.com/alexasomba/better-auth-paystack/issues/107)) ([a0e23b0](https://github.com/alexasomba/better-auth-paystack/commit/a0e23b052d7a8d7b9dd4095dc0558e670da8c1a1))
* update lockfile and remove stray test file ([4f3a153](https://github.com/alexasomba/better-auth-paystack/commit/4f3a1538e3ff9a4aed9543fa4071c763a9d545aa))
* update pnpm-lock.yaml for v1.0.0-rc.1 ([c4addfb](https://github.com/alexasomba/better-auth-paystack/commit/c4addfb5c85cceae10f696a7b3c9fd787c4f5549))
* Update rollup override to version 4.59.0. ([0ecc10e](https://github.com/alexasomba/better-auth-paystack/commit/0ecc10e6c9829bf63a6e8eb0b0f8bd4f9a580e78))


### Refactors

* Enhance Paystack SDK with improved API response unwrapping, metadata normalization, and updated type definitions, alongside tooling updates and example adjustments. ([9f6c790](https://github.com/alexasomba/better-auth-paystack/commit/9f6c790b262a4e5367def5a1fac0e2403d30a39e))
* Replace generic Error throws with APIError for improved error handling and clean up logger calls and comments. ([86972d9](https://github.com/alexasomba/better-auth-paystack/commit/86972d9e10d65551899e7c2479ca2f4881705c4f))
* standardize Better Auth base URL environment variable to `BETTER_AUTH_URL` across examples. ([f23192d](https://github.com/alexasomba/better-auth-paystack/commit/f23192d209ad94f7207823078e8fa2c7d7d09bd7))
* Wrap `data` variable in parentheses before optional chaining. ([bd5b6b6](https://github.com/alexasomba/better-auth-paystack/commit/bd5b6b60501e15dc088c19597c72254e9b92d782))


### Documentation

* Add a new section to the README detailing supported currencies and their minimum transaction amounts. ([1574151](https://github.com/alexasomba/better-auth-paystack/commit/157415181e874a25b9876183a1dcf2e6f9b4e368))
* Add explanatory comments and remove redundant root ownership entry in CODEOWNERS. ([6fcca90](https://github.com/alexasomba/better-auth-paystack/commit/6fcca9095821d73e1868e131b94ded3b9bcfba95))
* add explicit schema tables ([#6](https://github.com/alexasomba/better-auth-paystack/issues/6)) ([b91e114](https://github.com/alexasomba/better-auth-paystack/commit/b91e11438db2badbda83ec7603edca3ff9435c98))
* clarify cancelAtPeriodEnd behavior in README ([253e003](https://github.com/alexasomba/better-auth-paystack/commit/253e003e3156caaba49f1ca40f74a5260a58f69c))
* clarify optional db fields ([8a57279](https://github.com/alexasomba/better-auth-paystack/commit/8a57279a6a83f04e420a3bec016bdbc50b463c29))
* clarify optional db fields (closes [#59](https://github.com/alexasomba/better-auth-paystack/issues/59)) ([286dd96](https://github.com/alexasomba/better-auth-paystack/commit/286dd96ea657d70737ec57707440a2a83277baed))
* correct paystack-browser to paystack-inline ([4c29957](https://github.com/alexasomba/better-auth-paystack/commit/4c299576dcd16959206b176959d8d7bbaf6ad53c))
* correct paystack-browser to paystack-inline for popup modals ([#105](https://github.com/alexasomba/better-auth-paystack/issues/105)) ([4c29957](https://github.com/alexasomba/better-auth-paystack/commit/4c299576dcd16959206b176959d8d7bbaf6ad53c))
* fix markdown checklist syntax in README ([a3d6b2e](https://github.com/alexasomba/better-auth-paystack/commit/a3d6b2e44e34769b60d3eb767ecfa4045792766d))
* remove Stripe, Drizzle, Next.js, and Organization documentation files. ([af5b19f](https://github.com/alexasomba/better-auth-paystack/commit/af5b19fd666e8e7b7c2043fc7f4a9735ca82891f))
* update README and GEMINI with product sync and security fix details ([efe3cda](https://github.com/alexasomba/better-auth-paystack/commit/efe3cdaad779ad8fe7ff412826ba25681258bfc4))
* update README with Stripe parity features ([34ef1b4](https://github.com/alexasomba/better-auth-paystack/commit/34ef1b46d554c2a1788c966e061b7c7ff656a5ec))

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
