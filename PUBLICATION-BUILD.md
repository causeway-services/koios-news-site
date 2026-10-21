# Website production

The original website package owns rendering and guarded Cloudflare delivery.
The current writable
[Koios application](https://github.com/causeway-services/koios.news)
owns the property configuration, accepted content/data Git revisions, and
immutable website selection at `config/website-release.json`. Releasing a
renderer does not by itself install it into the application or deploy its
Cloudflare pages. The historical `causeway-services/koios-news` parent and
its `site.yml` workflow are **archived**, so do not try to reactivate that
historical release path.

Publish the **complete original** website package through Code's
source-registry closure producer, with its exact dependencies, original
PNPM lock, and independently verified registry integrity. Use the supported
Guix Node 24 and declared PNPM 11.28.5. The original
`pnpm-workspace.yaml` retains strict minimum-release-age and lifecycle
policy: only exact locked `esbuild@0.28.1` and
`workerd@1.20260828.1` build hooks are explicitly permitted; there
is no blanket lifecycle-script execution grant. Do not broaden approvals
as an installation shortcut. The older three-source workspace is retired:
libraries are received from their living package owners at the versions in
the actual source `package.json` and `pnpm-lock.yaml`.

Once an immutable package really exists, the current application must
select its exact website Git revision, version and SHA-512 digest in its
own `config/website-release.json`, reconcile the `services/website`
gitlink, and receive its own dependency/runtime closure through native
Cold Red Gate [Koios deployment composition](https://github.com/561-group/cold-red-gate-services-section/tree/main/deployment/applications/koios),
FeltOS and Guix/LAGOON. Preserve original independently admitted publication
inputs, host credentials and active jobs. The original website
`src/release.mjs` then owns the manifest comparison, preview, rollback,
production authorization and independent public verification. A merged
source change or package-version declaration is **not** registry proof or
public installation.

## October 21 GEO/SEO release-receiving boundary

Original [website source PR #2](https://github.com/causeway-services/koios-news-site/pull/2)
merged the canonical NewsMediaOrganization/WebSite publisher IDs with
166/166 native tests. Original
[discovery PR #3](https://github.com/causeway-services/koios-news-site/pull/3)
added two independently checked public-HTML publisher-linkage findings.
The [2026-10-21T21:22:44Z production audit](https://github.com/causeway-services/koios-news-site/actions/runs/39678276689)
still returned HTTP 200 pages with **no matching `@id` on the sampled
home/NewsArticle**. Thus, neither the source merge nor passing source
tests established that the semantic fix was installed.

The active application's last observed `config/website-release.json`
selected a **previous** `@causeway-services/koios-news-site@0.1.9`
artifact and the `services/website` Gitlink pointed at an older
revision. This source's package metadata declares `0.1.10`, but that
string is **not evidence of a corresponding accepted registry artifact
containing the later source commits**. The historical parent
[October 18 website receipt](https://github.com/causeway-services/koios-news/actions/runs/39139196189)
settled an older candidate as already live, not the October 21 fixes.

A true receiving record requires: exact qualified immutable package and
integrity; active application/Guix selection and source inputs; actual
guarded release receipts; independent live homepage `/#publisher`,
`/#website` and a real article's `publisher.@id` correspondence;
unchanged canonical/robots/sitemap/feed, editorial/article history and
customer-facing behavior. Re-run the existing dependency-free audit to
witness **`publisher-graph-linkage: pass`** and
**`article-publisher-linkage: pass`**. Treat missing Google Search Console
access, article citation depth, and the 20-new-articles-per-day publication
goal as separate, still-open obligations in the
[active newsroom](https://github.com/causeway-services/koios.news/issues/40).
No source document, test or GitHub Action by itself proves higher rankings,
AI citations, or paid customer receiving.

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
