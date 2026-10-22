/**
 * Publication and revision instants.
 *
 * Search, news and syndication consumers need a full ISO 8601 instant with an
 * explicit zone for `datePublished`, `dateModified`, `article:published_time`,
 * `<time datetime>`, the news sitemap's `publication_date` and RSS `pubDate`.
 * An article's front matter only has to carry a calendar `date`, so the
 * instant is derived from the strongest recorded fact, never invented:
 *
 *   published, in order
 *     1. `published_at` front matter        source "front-matter"
 *     2. the earliest recorded publication  source "publication-evidence"
 *        (`publication-evidence/<slug>/<source-sha256>/publication.json`,
 *        written when the newsroom renders the accepted manuscript)
 *     3. the calendar day at 12:00:00Z      source "date-noon-utc", precision "day"
 *
 *   modified, in order, never earlier than published
 *     1. the later of a `modified` instant and the render instant of the
 *        evidence record bound to this exact source digest
 *     2. a `modified` calendar day at 12:00:00Z (precision "day")
 *     3. the published instant
 *
 * The day-only fallback is noon UTC, not 00:00Z: midnight UTC falls on the
 * previous calendar day for every reader west of Greenwich, so a "June 19"
 * article would be reported as published on June 18. Noon UTC stays on the
 * recorded day from UTC-12 to UTC+11. Precision is carried with the value so
 * a page can show the day alone and never claim an hour it does not know.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** The documented stand-in hour for an article that only records its calendar day. */
export const DAY_ONLY_HOUR_UTC = "12:00:00Z";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

/**
 * Normalize an ISO 8601 date or instant to `YYYY-MM-DDTHH:MM:SSZ`, or return
 * undefined when it is not a real calendar instant. A date-time without a zone
 * is read as UTC, the zone this newsroom records its instants in.
 * @param {unknown} value
 * @returns {string|undefined}
 */
export function utcInstant(value) {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/u.exec(value);
  if (!match) return undefined;
  const milliseconds = Date.parse(`${match[1]}T${match[2]}${match[3] ?? "Z"}`);
  if (!Number.isFinite(milliseconds)) return undefined;
  return new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/u, "Z");
}

/** @param {string} day `YYYY-MM-DD` */
export function dayOnlyInstant(day) {
  if (!ISO_DAY.test(day)) throw new TypeError("a calendar day is required");
  return `${day}T${DAY_ONLY_HOUR_UTC}`;
}

/**
 * Read every recorded publication of every article: the evidence directory
 * holds `<slug>/<source-sha256>/publication.json`. A missing directory is an
 * empty record (a fresh property, or a fixture), not an error.
 * @param {string|undefined} directory
 * @returns {Map<string, {sourceSha256:string, acceptedAt?:string, renderedAt?:string}[]>}
 */
export function readPublicationEvidence(directory) {
  const bySlug = new Map();
  if (directory === undefined || !existsSync(directory) || !statSync(directory).isDirectory()) return bySlug;
  for (const slug of readdirSync(directory).filter((name) => SLUG.test(name)).sort()) {
    const versions = [];
    for (const digest of readdirSync(join(directory, slug)).filter((name) => SHA256.test(name)).sort()) {
      const file = join(directory, slug, digest, "publication.json");
      if (!existsSync(file)) continue;
      let record;
      try { record = JSON.parse(readFileSync(file, "utf8")); } catch { throw new Error(`publication evidence is not valid JSON: ${file}`); }
      if (record?.slug !== slug || record?.sourceSha256 !== digest) throw new Error(`publication evidence does not bind its own slug and digest: ${file}`);
      const acceptedAt = utcInstant(record.acceptedAt);
      const renderedAt = utcInstant(record.renderedAt);
      if (acceptedAt === undefined && renderedAt === undefined) continue;
      versions.push({ sourceSha256: digest, ...(acceptedAt ? { acceptedAt } : {}), ...(renderedAt ? { renderedAt } : {}) });
    }
    if (versions.length) bySlug.set(slug, versions);
  }
  return bySlug;
}

const instantOf = (version) => version.renderedAt ?? version.acceptedAt;
const earliest = (values) => values.reduce((best, value) => (best === undefined || value < best ? value : best), undefined);
const latest = (values) => values.reduce((best, value) => (best === undefined || value > best ? value : best), undefined);

/**
 * Resolve an article's publication and revision instants.
 * @param {{date:string, publishedAt?:string, modified?:string, sourceDigest?:string}} post
 * @param {{sourceSha256:string, acceptedAt?:string, renderedAt?:string}[]} [evidence] every recorded version of this article
 * @returns {{publishedInstant:string, publishedPrecision:"instant"|"day", publishedSource:string,
 *            modifiedInstant:string, modifiedPrecision:"instant"|"day", modifiedSource:string}}
 */
export function resolvePublicationInstants(post, evidence = []) {
  const frontMatter = utcInstant(post.publishedAt);
  const recorded = earliest(evidence.map(instantOf).filter(Boolean));
  const published = frontMatter
    ? { instant: frontMatter, precision: "instant", source: "front-matter" }
    : recorded
      ? { instant: recorded, precision: "instant", source: "publication-evidence" }
      : { instant: dayOnlyInstant(post.date), precision: "day", source: "date-noon-utc" };

  const claimed = post.modified === undefined ? undefined
    : ISO_DAY.test(post.modified) ? { instant: dayOnlyInstant(post.modified), precision: "day", source: "front-matter-day-noon-utc" }
      : utcInstant(post.modified) ? { instant: utcInstant(post.modified), precision: "instant", source: "front-matter" } : undefined;
  const rendered = evidence.filter((version) => version.sourceSha256 === post.sourceDigest).map(instantOf).filter(Boolean);
  const realInstants = [
    ...(claimed?.precision === "instant" ? [claimed.instant] : []),
    ...rendered,
  ];
  const best = latest(realInstants);
  let modified;
  if (best !== undefined) {
    modified = { instant: best, precision: "instant", source: best === claimed?.instant ? "front-matter" : "publication-evidence" };
  } else if (claimed) {
    modified = claimed;
  } else {
    modified = { instant: published.instant, precision: published.precision, source: "published" };
  }
  // A revision cannot precede the first publication.
  if (modified.instant < published.instant) modified = { instant: published.instant, precision: published.precision, source: "published" };
  return Object.freeze({
    publishedInstant: published.instant, publishedPrecision: published.precision, publishedSource: published.source,
    modifiedInstant: modified.instant, modifiedPrecision: modified.precision, modifiedSource: modified.source,
  });
}

/**
 * A post's resolved instants, deriving them when the post was not enriched by
 * the build (a page renderer called with a bare post record).
 * @param {{date:string, publishedAt?:string, modified?:string, sourceDigest?:string, publishedInstant?:string}} post
 */
export function postInstants(post) {
  return post.publishedInstant === undefined ? { ...post, ...resolvePublicationInstants(post) } : post;
}

/**
 * The calendar day a reader should see for a publication instant: the instant's
 * UTC day when the instant is a recorded fact, the article's own date otherwise.
 * @param {ReturnType<typeof postInstants>} post
 */
export function publishedDay(post) {
  return post.publishedPrecision === "instant" ? post.publishedInstant.slice(0, 10) : post.date;
}

/**
 * The newest revision among posts as a sitemap `lastmod`, or undefined when
 * there are none. A hub page changes when any article it lists changes.
 * @param {object[]} posts enriched posts
 * @returns {string|undefined}
 */
export function latestModified(posts) {
  return posts.reduce((best, post) => (best === undefined || post.modifiedInstant > best ? post.modifiedInstant : best), undefined);
}
