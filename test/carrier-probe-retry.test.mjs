import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { auditProduction } from "../src/carrier.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function writeCandidate(root) {
  const publicRoot = join(root, "public");
  mkdirSync(publicRoot);
  const files = new Map([
    ["404.html", Buffer.from("not found\n")],
    ["index.html", Buffer.from("<!doctype html><title>Koios</title>\n")],
  ]);
  for (const [file, bytes] of files) writeFileSync(join(publicRoot, file), bytes);
  const artifacts = [...files].map(([file, bytes]) => ({ file, sha256: sha256(bytes), bytes: bytes.length }));
  const manifest = Buffer.from(`${JSON.stringify({
    kind: "news-property.build-manifest/v1",
    provenance: { origin: "https://koios.news" },
    artifacts,
  })}\n`);
  writeFileSync(join(publicRoot, "manifest.json"), manifest);
  return { publicRoot, manifest, files };
}

function response(url, status, bytes, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: (name) => headers[name.toLowerCase()] },
    body: { cancel: async () => undefined },
    arrayBuffer: async () => bytes,
  };
}

test("production audit retries transient body-read timeouts before accepting exact bytes", async () => {
  const root = mkdtempSync(join(tmpdir(), "koios-carrier-probe-"));
  try {
    const { publicRoot, manifest, files } = writeCandidate(root);
    const manifestDigest = sha256(manifest);
    let indexReads = 0, missingReads = 0;
    const fetchImpl = async (input) => {
      const url = input.href ?? input.toString();
      if (url === "https://koios.news/manifest.json") {
        return response(url, 200, manifest, { "content-length": String(manifest.length) });
      }
      if (url === `https://koios.news/__koios_missing_${manifestDigest.slice(0, 16)}/`) {
        missingReads += 1;
        if (missingReads === 1) throw new DOMException("body stalled", "TimeoutError");
        return response(url, 404, files.get("404.html"));
      }
      if (url === "https://koios.news/404") {
        return response(url, 200, files.get("404.html"), { "content-length": String(files.get("404.html").length) });
      }
      if (url === "https://koios.news/") {
        indexReads += 1;
        if (indexReads === 1) {
          return { ...response(url, 200, files.get("index.html"), { "content-length": String(files.get("index.html").length) }),
            arrayBuffer: async () => { throw new DOMException("body stalled", "TimeoutError"); } };
        }
        return response(url, 200, files.get("index.html"), { "content-length": String(files.get("index.html").length) });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const receipt = await auditProduction({
      candidateDir: publicRoot,
      bindingPath: new URL("../release/koios-news-primary-binding.json", import.meta.url).pathname,
      receiptOut: join(root, "audit.json"),
      fetchImpl,
    });

    assert.equal(receipt.probe.accepted, true);
    assert.equal(indexReads, 2);
    assert.equal(missingReads, 2);
    assert.equal(JSON.parse(readFileSync(join(root, "audit.json"), "utf8")).probe.accepted, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
