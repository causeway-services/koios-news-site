import test from "node:test";
import assert from "node:assert/strict";
import { renderCorrectionsHtml } from "../src/render/corrections.mjs";

test("corrections register exposes reader error and accessibility intake even when empty", () => {
  const html = renderCorrectionsHtml([]);
  assert.match(html, /id="report-an-error"/);
  assert.match(html, /mailto:nik@koios\.news\?subject=/);
  assert.match(html, /factual error or an accessibility barrier/);
  assert.match(html, /Please do not email sensitive personal information/);
  assert.match(html, /id="published-corrections"/);
  assert.match(html, /not evidence that every article is error-free/);
});

test("reader intake remains visible alongside an existing correction", () => {
  const html = renderCorrectionsHtml([{article:{slug:"example",title:"Example"},date:"2026-10-11",note:"Fixed a date."}]);
  assert.match(html, /mailto:nik@koios\.news/);
  assert.match(html, /\/posts\/example\//);
  assert.match(html, /Fixed a date/);
});
