import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { acceptPreviewProbe, auditProduction } from "../src/carrier.mjs";

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

/**
 * A disposable original sealed website candidate. No Cloudflare deployment,
 * invented release grant or alternate public publisher is involved.
 */
function assuranceCandidate(root, withdrawnHtml) {
  const publicRoot = join(root, "public");
  mkdirSync(publicRoot, { recursive: true });
  const files = new Map([
    ["404.html", Buffer.from("not found\\n")],
    ["assets/site.css", Buffer.from("main { display: block }\\n")],
    ["corrections/index.html", Buffer.from('<a href="#main-content">Skip to content</a><main id="main-content" tabindex="-1">Corrections</main>')],
    ["index.html", Buffer.from('<a href="#main-content">Skip to content</a><main id="main-content" tabindex="-1">Home</main>')],
    ["posts/published-source/index.html", Buffer.from('<main id="main-content" tabindex="-1"><h1>Published Source</h1></main>')],
    ["posts/withdrawn-source/index.html", Buffer.from(withdrawnHtml)],
  ]);
  const entries = [...files.entries()].sort(([a],[b]) => Buffer.compare(Buffer.from(a),Buffer.from(b)));
  for (const [file,bytes] of entries) {
    mkdirSync(dirname(join(publicRoot,file)),{recursive:true});
    writeFileSync(join(publicRoot,file),bytes);
  }
  const manifest = Buffer.from(JSON.stringify({
    kind:"news-property.build-manifest/v1",provenance:{origin:"https://koios.news"},
    artifacts:entries.map(([file,bytes])=>({file,sha256:sha256(bytes),bytes:bytes.length})),
  })+"\\n");
  writeFileSync(join(publicRoot,"manifest.json"),manifest);
  return {publicRoot,manifest,files};
}

const accessibleNotice = `<!doctype html>
<a class="skip-to-content" href="#main-content">Skip to content</a>
<link rel="canonical" href="https://koios.news/posts/withdrawn-source/">
<meta name="robots" content="noindex, follow">
<main id="main-content" tabindex="-1" role="main"><h1>Article unavailable</h1>
<a href="/corrections/">Corrections</a><a href="/archive/">Browse published articles</a></main>`;

function previewFixtureFetch(candidate,{staleNotice=false}={}) {
  const previewUrl="https://koios-release-assurance-test.workers.dev/";
  const digest=sha256(candidate.manifest);
  const paths = new Map([
    ["manifest.json",candidate.manifest],
    ["",candidate.files.get("index.html")],
    ["corrections/",candidate.files.get("corrections/index.html")],
    ["posts/published-source/",candidate.files.get("posts/published-source/index.html")],
    ["posts/withdrawn-source/",candidate.files.get("posts/withdrawn-source/index.html")],
    ["assets/site.css",candidate.files.get("assets/site.css")],
    ["404",candidate.files.get("404.html")],
  ]);
  const requested=[];
  const fetchImpl=async input=>{
    const url=input.href??String(input),path=new URL(url).pathname.slice(1);
    requested.push(path);
    if(path===`__koios_missing_${digest.slice(0,16)}/`)return response(url,404,candidate.files.get("404.html"));
    let bytes=paths.get(path);
    if(bytes===undefined)throw new Error(`unrecognized preview route: ${path}`);
    if(staleNotice&&path==="posts/withdrawn-source/") {
      bytes=Buffer.from(bytes);
      bytes[0]=bytes[0]===65?66:65;
    }
    return response(url,200,bytes,{"content-length":String(bytes.length)});
  };
  return {previewUrl,fetchImpl,requested};
}

test("Cloudflare preview explicitly receives accessible withdrawn notices, corrections and real articles", async()=>{
  const root=mkdtempSync(join(tmpdir(),"koios-preview-assurance-"));
  try{
    const candidate=assuranceCandidate(root,accessibleNotice);
    const {previewUrl,fetchImpl,requested}=previewFixtureFetch(candidate);
    const receipt=await acceptPreviewProbe({
      candidateDir:candidate.publicRoot,
      bindingPath:new URL("../release/koios-news-primary-binding.json",import.meta.url).pathname,
      url:previewUrl,fetchImpl,
    });
    assert.equal(receipt.probe.accepted,true);
    const selected=receipt.probe.artifacts.map(x=>x.file);
    for(const critical of ["index.html","corrections/index.html",
      "posts/published-source/index.html","posts/withdrawn-source/index.html"]) {
      assert.ok(selected.includes(critical),`mandatory receiving absent: ${critical}`);
    }
    assert.ok(requested.includes("posts/withdrawn-source/"));
    assert.ok(requested.includes("corrections/"));
    const stale=previewFixtureFetch(candidate,{staleNotice:true});
    await assert.rejects(()=>acceptPreviewProbe({
      candidateDir:candidate.publicRoot,
      bindingPath:new URL("../release/koios-news-primary-binding.json",import.meta.url).pathname,
      url:stale.previewUrl,fetchImpl:stale.fetchImpl,
    }),/served sealed artifact does not match: posts\\/withdrawn-source\\/index\\.html/u);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test("Cloudflare preview refuses an old withdrawn-page renderer before accepting its receipt",async()=>{
  const root=mkdtempSync(join(tmpdir(),"koios-preview-inaccessible-"));
  try{
    const inaccessible=accessibleNotice.replace(
      '<a class="skip-to-content" href="#main-content">Skip to content</a>',"");
    const candidate=assuranceCandidate(root,inaccessible);
    const {previewUrl,fetchImpl}=previewFixtureFetch(candidate);
    await assert.rejects(()=>acceptPreviewProbe({
      candidateDir:candidate.publicRoot,
      bindingPath:new URL("../release/koios-news-primary-binding.json",import.meta.url).pathname,
      url:previewUrl,fetchImpl,
    }),/preview withdrawn-notice assurance failed: posts\\/withdrawn-source\\/index\\.html/u);
  }finally{rmSync(root,{recursive:true,force:true});}
});
