/**
 * `llms.txt` and `llms-full.txt`: a plain-text guide to the property for
 * language-model agents (https://llmstxt.org). `llms.txt` is the short
 * orientation, with the newest articles; `llms-full.txt` is the complete
 * article index, grouped by section. Both carry links and the facts the
 * build already knows (headline, section, publication instant, summary);
 * neither carries article bodies. Bodies are served from the article pages,
 * which are where any crawler price and the page's own markup apply.
 */
import { aiAuthorshipStatement, authorProfile } from "./authors.mjs";

const LATEST = 30;
const oneLine = (text) => String(text ?? "").replace(/\s+/gu, " ").trim();
const absolute = (property, path) => new URL(path, property.origin).toString();

function articleLine(property, post) {
  const detail = [post.sectionTitle, `published ${post.publishedInstant}`].filter(Boolean).join(", ");
  const summary = oneLine(post.description);
  return `- [${oneLine(post.title).replace(/[[\]]/gu, "")}](${absolute(property, `/posts/${post.slug}/`)}): ${summary}${summary ? " " : ""}(${detail})`;
}

function aiStatements(property, posts) {
  const seen = new Map();
  for (const post of posts) {
    if (seen.has(post.authorSlug)) continue;
    const statement = aiAuthorshipStatement(property, { name: post.author, slug: post.authorSlug });
    if (statement) seen.set(post.authorSlug, statement);
  }
  return [...seen.values()];
}

function head(property, posts) {
  const accessNote = property.monetization?.payPerCrawl
    ? [`Article pages under /posts/ are offered to crawlers through Cloudflare pay-per-crawl: responses quote a Crawler-Price header, and a priced crawler that has not agreed to it may receive 402 Payment Required. This guide and the feeds are free to fetch.`]
    : [];
  return [
    `# ${property.name}`,
    ``,
    `> ${oneLine(property.tagline) || property.name}`,
    ``,
    `${property.name} is a news publication of ${oneLine(typeof property.masthead?.publisher === "string" ? property.masthead.publisher : property.masthead?.publisher?.name) || "its publisher"}. ` +
      `${oneLine(property.masthead?.editorialMethod)}`.trim(),
    ...aiStatements(property, posts).flatMap((statement) => [``, oneLine(statement)]),
    ...(accessNote.length ? [``, ...accessNote] : []),
  ];
}

function policies(property) {
  return [
    `## Editorial policy`,
    ``,
    `- [Standards](${absolute(property, "/standards/")}): how reporting is sourced, assisted by software and checked`,
    `- [Corrections](${absolute(property, "/corrections/")}): the public corrections register and how to report an error`,
    `- [Masthead](${absolute(property, "/masthead/")}): publisher, desks and bylines`,
    `- [About](${absolute(property, "/about/")}): ownership and funding`,
    `- [Contact](${absolute(property, "/contact/")}): how to reach the newsroom`,
  ];
}

/**
 * @param {object} property
 * @param {object[]} posts enriched posts, newest first
 */
export function renderLlmsTxt(property, posts) {
  const sections = (property.sections ?? []).map((section) =>
    `- [${oneLine(section.title)}](${absolute(property, `/sections/${section.slug}/`)})${section.description ? `: ${oneLine(section.description)}` : ""}`);
  const lines = [
    ...head(property, posts), ``,
    `## Sections`, ``, ...sections, ``,
    ...policies(property), ``,
    `## Machine-readable`, ``,
    `- [RSS feed](${absolute(property, "/feed.xml")}): the latest articles`,
    `- [JSON Feed](${absolute(property, "/feed.json")}): the latest articles as JSON`,
    `- [Sitemap](${absolute(property, "/sitemap.xml")}): every page, with last-modified instants`,
    `- [Search index](${absolute(property, "/search.json")}): article text for local search`,
    `- [Corrections register](${absolute(property, "/corrections.json")}): corrections as JSON`, ``,
    `## Latest articles`, ``, ...posts.slice(0, LATEST).map((post) => articleLine(property, post)), ``,
    `## Optional`, ``,
    `- [Full article index](${absolute(property, "/llms-full.txt")}): every published article, by section`, ``,
  ];
  return lines.join("\n");
}

/**
 * @param {object} property
 * @param {object[]} posts enriched posts, newest first
 */
export function renderLlmsFullTxt(property, posts) {
  const bySection = new Map();
  for (const post of posts) bySection.set(post.section, [...(bySection.get(post.section) ?? []), post]);
  const blocks = (property.sections ?? []).filter((section) => bySection.has(section.slug)).flatMap((section) => [
    `## ${oneLine(section.title)}`, ``, ...bySection.get(section.slug).map((post) => articleLine(property, post)), ``,
  ]);
  const authors = [...new Map(posts.map((post) => [post.authorSlug, post.author])).entries()]
    .filter(([slug]) => Object.keys(authorProfile(property, slug)).length > 0)
    .map(([slug, name]) => `- ${name}: ${absolute(property, `/authors/${slug}/`)}`);
  return [
    ...head(property, posts), ``,
    `${posts.length} published articles, newest first within each section. Each entry gives the headline, link, summary, section and publication instant (UTC).`, ``,
    ...blocks,
    ...(authors.length ? [`## Author profiles`, ``, ...authors, ``] : []),
    ...policies(property), ``,
  ].join("\n");
}
