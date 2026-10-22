/**
 * Bylines: who an article is attributed to, the one URL that names them, and
 * the disclosure that an AI editorial character is not a human journalist.
 *
 * A byline has exactly one canonical address. A person-style byline (a named
 * AI editorial character) is `/authors/<slug>/`. A coverage-desk byline
 * ("Koios.News Technology Desk") is not a person and has no profile of its own;
 * it is the desk page of the section it files to most often, and the
 * historical `/authors/<desk-slug>/` address is a 301 to that desk.
 */

/** @param {object} property @param {string} name */
export function isDeskByline(property, name) {
  return name.startsWith(`${property.name} `) && name.endsWith(" Desk");
}

/**
 * The masthead record for an author slug: `{ jobTitle?, kind?, disclosure?, sameAs? }`.
 * @param {object} property @param {string} slug
 */
export function authorProfile(property, slug) {
  const record = property.masthead?.authorProfiles?.[slug];
  return record !== null && typeof record === "object" ? record : {};
}

/**
 * The section each desk byline files to most often (ties: the earlier slug).
 * @param {object} property
 * @param {{author:string, authorSlug:string, section:string}[]} posts
 * @returns {Map<string,string>} desk-byline author slug -> section slug
 */
export function deskBylineSections(property, posts) {
  const counts = new Map();
  for (const post of posts) {
    if (!isDeskByline(property, post.author)) continue;
    const bySection = counts.get(post.authorSlug) ?? new Map();
    bySection.set(post.section, (bySection.get(post.section) ?? 0) + 1);
    counts.set(post.authorSlug, bySection);
  }
  return new Map([...counts].map(([slug, bySection]) => [slug,
    [...bySection].sort(([leftSlug, left], [rightSlug, right]) => right - left || (leftSlug < rightSlug ? -1 : 1))[0][0]]));
}

/**
 * The canonical site-relative address of an article's byline. The build stamps
 * `authorPath` on each post; a bare post record falls back to its own section.
 * @param {object} property
 * @param {{author:string, authorSlug:string, section:string, authorPath?:string}} post
 */
export function authorPathFor(property, post) {
  if (post.authorPath !== undefined) return post.authorPath;
  return isDeskByline(property, post.author) ? `/desks/${post.section}/` : `/authors/${post.authorSlug}/`;
}

/**
 * The visible statement of what kind of author this is, or undefined for a
 * desk byline (which the standards page already describes).
 * @param {object} property
 * @param {{name:string, slug:string}} author
 * @returns {string|undefined}
 */
export function aiAuthorshipStatement(property, author) {
  const profile = authorProfile(property, author.slug);
  if (typeof profile.disclosure === "string" && profile.disclosure.trim() !== "") return profile.disclosure.trim();
  if (profile.kind !== "ai") return undefined;
  const role = typeof profile.jobTitle === "string" && profile.jobTitle.trim() !== ""
    ? `${author.name} is the ${profile.jobTitle.trim()} of ${property.name}. ` : "";
  return `${role}${author.name} is an artificial-intelligence editorial character, not a human journalist. ` +
    `Articles under this byline are researched and drafted with AI, bound to cited sources, and published only after independent editorial assessment.`;
}
