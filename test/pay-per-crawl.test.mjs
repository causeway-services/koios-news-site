import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProperty } from "../src/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureProperty = () => JSON.parse(readFileSync(join(here, "fixtures", "property.json"), "utf8"));

function renderedAssets(policy) {
  const scratch = mkdtempSync(join(tmpdir(), "koios-crawler-pricing-"));
  const contentDir = join(scratch, "content");
  const outputDir = join(scratch, "public");
  cpSync(join(here, "fixtures", "content"), contentDir, { recursive: true });
  const property = fixtureProperty();
  if (policy !== undefined) property.monetization.payPerCrawl = policy;
  try {
    buildProperty({ property, contentDir, outputDir, asOf: new Date("2026-07-20T00:00:00Z") });
    return {
      headers: readFileSync(join(outputDir, "_headers"), "utf8"),
      robots: readFileSync(join(outputDir, "robots.txt"), "utf8"),
      sitemap: readFileSync(join(outputDir, "sitemap.xml"), "utf8"),
      manifest: JSON.parse(readFileSync(join(outputDir, "manifest.json"), "utf8")),
    };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

test("Cloudflare crawler price is scoped to published article paths, never a wildcard paywall", () => {
  const plain = renderedAssets();
  assert.doesNotMatch(plain.headers, /crawler-price/iu);
  const priced = renderedAssets({ protocol: "cloudflare", articlePriceUsd: "0.010" });
  assert.match(priced.headers, /^\/\*\n  Content-Security-Policy:/u);
  assert.match(priced.headers, /\n\/posts\/\*\n  Crawler-Price: USD 0\.010\n/u);
  assert.doesNotMatch(priced.headers, /\n\/(?:v1|mcp|api|search|robots|sitemap)\//u);
  assert.equal(priced.headers.match(/Crawler-Price:/gu)?.length, 1);
  assert.match(priced.robots, /Sitemap:/u);
  assert.match(priced.sitemap, /sitemap/u);
  assert.ok(priced.manifest.artifacts.some(row => row.file === "_headers"));
});

test("invalid, injected and misleading Cloudflare price policies are rejected at build", () => {
  for (const policy of [
    { protocol: "x402", articlePriceUsd: "0.010" },
    { protocol: "cloudflare", articlePriceUsd: "0.000" },
    { protocol: "cloudflare", articlePriceUsd: "0.00" },
    { protocol: "cloudflare", articlePriceUsd: "-0.01" },
    { protocol: "cloudflare", articlePriceUsd: "1e3" },
    { protocol: "cloudflare", articlePriceUsd: "0.01\n/robots.txt\n  Crawler-Price: USD 1.00" },
    { protocol: "cloudflare", articlePriceUsd: 0.01 },
  ]) assert.throws(() => renderedAssets(policy), /payPerCrawl requires Cloudflare/u);
});
