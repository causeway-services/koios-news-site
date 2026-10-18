import { escapeHtml } from "./markdown.mjs";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function checked(entry, index) {
  if (!entry || typeof entry !== "object" || !entry.article || typeof entry.article !== "object") {
    throw new TypeError(`corrections[${index}] needs an article record`);
  }
  const { slug, title } = entry.article;
  if (typeof slug !== "string" || !SLUG.test(slug)) {
    throw new TypeError(`corrections[${index}] has an invalid article slug`);
  }
  if (typeof title !== "string" || !title.trim()) {
    throw new TypeError(`corrections[${index}] needs a nonempty article title`);
  }
  if (typeof entry.date !== "string" || !ISO_DAY.test(entry.date) ||
      Number.isNaN(Date.parse(`${entry.date}T00:00:00Z`)) ||
      new Date(`${entry.date}T00:00:00Z`).toISOString().slice(0, 10) !== entry.date) {
    throw new TypeError(`corrections[${index}] needs a real ISO calendar date`);
  }
  if (typeof entry.note !== "string" || !entry.note.trim()) {
    throw new TypeError(`corrections[${index}] needs a nonempty correction note`);
  }
  return { slug, title, date: entry.date, note: entry.note };
}

/**
 * Public HTML projection of the exact corrections.json register.
 * Empty record does not assert that all articles are correct.
 */
export function renderCorrectionsHtml(entries) {
  if (!Array.isArray(entries)) throw new TypeError("corrections register must be an array");
  const listed = entries.map(checked).sort((a, b) =>
    cmp(b.date, a.date) || cmp(a.slug, b.slug) || cmp(a.note, b.note));
  const intro = '<p>Material corrections are recorded on the affected article and in this register. Each entry gives the correction date and what changed.</p>' +
    '<h2 id="report-an-error">Report an error or accessibility problem</h2>' +
    '<p>Readers can email <a href="mailto:nik@koios.news?subject=Koios.News%20correction%20or%20accessibility%20report">nik@koios.news</a> about a factual error or an accessibility barrier. Include the article URL, the problem, and any supporting source. Please do not email sensitive personal information. Sending a report does not mean a correction has been accepted or published; email delivery and editorial acknowledgement are separate. This address is a contact route; receipt and response are not guaranteed.</p>' +
    '<p><a href="/corrections.json">Machine-readable corrections register (JSON)</a>.</p>';
  if (!listed.length) return intro +
    '<h2 id="published-corrections">Published corrections</h2>' +
    '<p>No corrections are listed in this publication record. This is not evidence that every article is error-free.</p>';
  return intro + '<h2 id="published-corrections">Published corrections</h2>' +
    '<ol aria-labelledby="published-corrections">' +
    listed.map(({ slug, title, date, note }) =>
      `<li><time datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>: <a href="/posts/${slug}/">${escapeHtml(title)}</a> — ${escapeHtml(note)}</li>`).join("") +
    '</ol>';
}
