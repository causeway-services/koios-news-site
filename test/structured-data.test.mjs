import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildProperty } from "../src/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function jsonLdObjects(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)]
    .map((match) => JSON.parse(match[1]));
}

test("article structured data exposes accepted source citations", () => {
  const scratch = mkdtempSync(join(tmpdir(), "news-property-structured-data-"));
  try {
    const contentDir = join(scratch, "content");
    const outputDir = join(scratch, "public");
    cpSync(join(here, "fixtures", "content"), contentDir, { recursive: true });
    const property = JSON.parse(readFileSync(join(here, "fixtures", "property.json"), "utf8"));
    buildProperty({ property, contentDir, outputDir, asOf: new Date("2026-07-20T00:00:00Z") });

    const html = readFileSync(join(outputDir, "posts", "ai-compute-bottleneck-power-problem", "index.html"), "utf8");
    const article = jsonLdObjects(html).find((object) => object["@type"] === "NewsArticle");

    assert.ok(article, "article page must include NewsArticle JSON-LD");
    const records = JSON.parse(readFileSync(join(outputDir, "posts", "ai-compute-bottleneck-power-problem", "citation.json"), "utf8"));
    assert.equal(records.length, 1);
    const citation = records[0];
    assert.equal(citation.type, "article-newspaper");
    assert.equal(citation.URL, article.url);
    assert.equal(citation.title, article.headline);
    assert.deepEqual(citation.author, [{literal:article.author.name}]);
    assert.deepEqual(citation.issued['date-parts'][0], article.datePublished.slice(0,10).split('-').map(Number));
    assert.equal(citation.DOI, undefined);
    assert.equal(citation.ISSN, undefined);
    assert.match(html, /name="citation_title"/u);
    assert.match(html, /name="citation_publication_date"/u);
    assert.match(html, /Cite this article \(CSL-JSON\)/u);
    assert.ok(JSON.parse(readFileSync(join(outputDir, "citations.json"), "utf8")).some(item=>item.id===citation.id));
    // Canonical page identity, public readability and source-controlled rights
    // must be projected into structured data, never guessed by an SEO bot.
    assert.deepEqual(article.mainEntityOfPage, { "@type": "WebPage",
      "@id": "https://koios.news/posts/ai-compute-bottleneck-power-problem/" });
    assert.equal(article.isAccessibleForFree, true);
    assert.equal(article.license, "https://creativecommons.org/licenses/by/4.0/");
    assert.deepEqual(article.citation, [
      "https://www.technologyreview.com/2026/06/19/1139313/a-startup-claims-it-broke-through-a-bottleneck-thats-holding-back-llms/",
      "https://www.theregister.com/systems/2026/06/19/tensordyne-makes-a-big-bet-on-log-math-to-beat-nvidia/5258662",
      "https://www.technologyreview.com/2026/06/16/1138591/data-center-online-quickly-electric-grid-flex/",
      "https://spectrum.ieee.org/orbital-data-centers-heat",
      "https://www.theregister.com/software/2026/05/05/openai-exec-says-it-will-burn-50b-on-compute-this-year/5226088",
    ]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
