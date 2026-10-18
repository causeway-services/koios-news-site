import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCorrectionsHtml } from "../src/render/corrections.mjs";
import { buildProperty } from "../src/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const entry = (slug, title, date, note) => ({article:{slug,title},date,note});

test("public corrections renderer sorts records and safely escapes human text", () => {
  const html = renderCorrectionsHtml([
    entry("older-story","An <old> & story","2026-10-01","Corrected <script>alert(1)</script> & details"),
    entry("newer-story","A newer story","2026-10-10","New source"),
  ]);
  assert.ok(html.indexOf("newer-story") < html.indexOf("older-story"));
  assert.match(html, /An &lt;old&gt; &amp; story/);
  assert.match(html, /Corrected &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; details/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /href="\/corrections.json"/);
});

test("empty register does not assert that published reporting is error-free", () => {
  const html = renderCorrectionsHtml([]);
  assert.match(html, /No corrections are listed/);
  assert.match(html, /not evidence that every article is error-free/);
});

test("malformed correction records fail before publishing HTML", () => {
  for (const bad of [
    entry("Bad/Slug","Title","2026-10-10","note"),
    entry("some-story","Title","2026-02-30","note"),
    entry("some-story","Title","2026-10-10"," "),
    entry("some-story"," ","2026-10-10","note"),
    {date:"2026-10-10",note:"note"},
  ]) assert.throws(() => renderCorrectionsHtml([bad]));
  assert.throws(() => renderCorrectionsHtml(null));
});

test("site build exposes the exact published correction in both reader HTML and JSON", (t) => {
  const root = mkdtempSync(join(tmpdir(), "koios-corrections-"));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  const contentDir = join(root,"content"), outputDir = join(root,"public");
  cpSync(join(here,"fixtures","content"),contentDir,{recursive:true});
  const post = join(contentDir,"posts","hello-world.md");
  const original = readFileSync(post,"utf8");
  assert.match(original,/draft: false/u);
  writeFileSync(post,original.replace("draft: false\n",
    'draft: false\ncorrections: [{"date":"2026-10-10","note":"Corrected <claim> & citation."}]\n'));
  const property = JSON.parse(readFileSync(join(here,"fixtures","property.json"),"utf8"));
  buildProperty({property,contentDir,outputDir,asOf:new Date("2026-10-10T12:00:00Z")});
  const json = JSON.parse(readFileSync(join(outputDir,"corrections.json"),"utf8"));
  const row = json.corrections.find(value => value.article.slug === "hello-world" && value.date === "2026-10-10");
  assert.ok(row,"published article correction enters machine-readable register");
  const html = readFileSync(join(outputDir,"corrections","index.html"),"utf8");
  assert.match(html,/Hello World From Koios.News/);
  assert.match(html,/Corrected &lt;claim&gt; &amp; citation/);
  assert.match(html, /href="\/posts\/hello-world\/"/);
  assert.ok(json.correctionCount >= 1);
});
