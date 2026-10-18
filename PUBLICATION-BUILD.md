# Website production

The website package owns rendering and Cloudflare delivery. The newsroom owns
the property configuration and exact content/data Git revisions. A renderer
release does not require replacing the newsroom application.

Publish the complete package through Code's source-registry closure producer.
Its exact registry dependencies and native PNPM lock travel in the artifact.
Use Guix Node 24 and the declared PNPM 11.28.5; lifecycle scripts stay disabled.
The former three-source workspace is retired: those libraries are received from
their living package owners at the versions in package.json and pnpm-lock.yaml.

The parent newsroom's config/website-release.json selects the published package,
SHA-512 integrity, website Git revision and PNPM supplier. Its website workflow
receives actual registry artifacts with Code, installs the frozen lock and builds
from the parent revision's exact property/content/data inputs. This uses the
machine's Guix runtime and existing credential custody.

For an already received runtime, supply absolute publication input paths:

```sh
export NEWS_PROPERTY_CONTENT_ROOT=/absolute/pinned-content
export NEWS_PROPERTY_STATE_ROOT=/absolute/pinned-data
export NEWS_PROPERTY_CLAIM_STORE="$NEWS_PROPERTY_STATE_ROOT/claims"
export NEWS_PROPERTY_SOURCE_FEEDS=/absolute/pinned-house-feeds.json
node scripts/build-property.mjs /absolute/koios-news-property.json /absolute/public \
  --as-of 2026-10-16T23:00:00.000Z
node scripts/release-property.mjs /absolute/public /absolute/receipts
```

The release retains the existing Cloudflare binding, public baseline, article-route
preservation, preview deployment and probe, rollback binding, production authority
and independent public receiving. It does not grant editorial publication authority
or change accepted manuscripts. Progress observation cannot retry or authorize an
effect. Production failures retain the original failure and cleanup outcome.

The corrections page exposes the register and contact address, privacy guidance
and distinct delivery/editorial boundaries. Rendering the address does not establish
mailbox custody, delivery or competent acknowledgement; issue16 remains open until
its separate receiving conditions are met.
