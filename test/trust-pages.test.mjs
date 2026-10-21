import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildProperty } from "../src/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function buildFixture() {
  const scratch = mkdtempSync(join(tmpdir(), "news-property-trust-pages-"));
  const contentDir = join(scratch, "content");
  const outputDir = join(scratch, "public");
  cpSync(join(here, "fixtures", "content"), contentDir, { recursive: true });
  const property = JSON.parse(readFileSync(join(here, "fixtures", "property.json"), "utf8"));
  buildProperty({ property, contentDir, outputDir, asOf: new Date("2026-07-20T00:00:00Z") });
  return { scratch, outputDir };
}

test("static trust pages disclose ownership, funding, and AI-assisted process", () => {
  const { scratch, outputDir } = buildFixture();
  try {
    const about = readFileSync(join(outputDir, "about", "index.html"), "utf8");
    const standards = readFileSync(join(outputDir, "standards", "index.html"), "utf8");
    const standardsJson = JSON.parse(readFileSync(join(outputDir, "standards.json"), "utf8"));

    assert.match(about, /id="ownership"/);
    assert.match(about, /owned and published by The 561 Group/);
    assert.match(about, /advertising and offers paid products/);
    assert.match(standards, /Software and AI agents may assist source research/);
    assert.match(standards, /independent acceptance/);
    assert.ok(standardsJson.policies.includes("Disclose software and AI assistance in the publication method."));
    assert.deepEqual(standardsJson.ownership, {
      publisher: "Nik Koios",
      owner: "The 561 Group",
      funding: "The 561 Group funds this publication. Koios.News also carries advertising and offers paid products; those revenue paths do not buy editorial coverage.",
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("the shared skip link targets one programmatically focusable main landmark on public trust surfaces", () => {
  const { scratch, outputDir } = buildFixture();
  try {
    for (const relative of ["index.html", "about/index.html", "standards/index.html", "corrections/index.html"]) {
      const html = readFileSync(join(outputDir, relative), "utf8");
      const skip = '<a class="skip-to-content" href="#main-content">Skip to content</a>';
      const main = '<main id="main-content" tabindex="-1" role="main">';
      assert.ok(html.includes(skip), relative + ": missing keyboard skip affordance");
      assert.ok(html.includes(main), relative + ": missing focusable main landmark");
      assert.ok(html.indexOf(skip) < html.indexOf(main), relative + ": skip link must precede main");
      assert.equal((html.match(/id="main-content"/gu) ?? []).length, 1,
        relative + ": ambiguous duplicate main anchor");
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
