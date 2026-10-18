import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { houseAdClientScript } from "../src/render/house-ad-client.mjs";

function element(tagName) {
  return { tagName, children: [], attributes: {}, textContent: "", className: "",
    appendChild(child) { this.children.push(child); },
    setAttribute(key, value) { this.attributes[key] = value; } };
}
async function render(creative, context = "sport,football", adServer = "https://ads.561.group") {
  const host = element("div");
  host.dataset = { adServer, slot: "afterArticle", property: "Koios.News", context };
  const requests = [];
  const document = {
    querySelectorAll: () => [host],
    createElement: element,
    createTextNode: (textContent) => ({ tagName: "#text", textContent }),
  };
  runInNewContext(houseAdClientScript(), { document, URL, encodeURIComponent, Date, Number, Set, Array,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ creative }) };
    }
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { host, requests };
}
const creative = {
  id: "kalshi-predictions", title: "Explore football prediction markets",
  kind: "referral", body: "Eligible new users may qualify for a bonus up to $25.",
  disclosure: "The publisher may earn a reward if you qualify through this link.",
  eligibility: "Offer terms, location, age and qualifying activity requirements apply.",
  riskNotice: "Trading involves financial risk; losses are possible.",
  allowedContexts: ["sport", "football"], expiresAt: "2099-12-31T23:59:59Z",
};

test("the existing house ad remains backwards compatible", async () => {
  const { host, requests } = await render({ id: "briefing", title: "Our briefing" });
  assert.equal(host.children.length, 2);
  assert.equal(host.children[0].textContent, "From the publisher");
  assert.equal(host.children[1].href,
    "https://ads.561.group/click?slot=afterArticle&property=Koios.News&creative=briefing");
  assert.equal(requests[0].options.credentials, "omit");
});

test("external referral discloses benefit before CTA and shows risk and terms", async () => {
  const { host, requests } = await render(creative);
  assert.equal(host.children.length, 5);
  assert.equal(host.children[0].textContent, "Advertisement · Referral offer");
  assert.equal(host.children[1].textContent, "The publisher may receive a referral reward when you use this offer. " + creative.disclosure);
  assert.equal(host.children[2].tagName, "a");
  assert.equal(host.children[2].rel, "sponsored noopener noreferrer");
  assert.equal(host.children[3].textContent, creative.eligibility);
  assert.equal(host.children[4].textContent, creative.riskNotice);
  assert.equal(host.attributes["aria-label"], "Referral advertisement");
  const url = new URL(requests[0].url);
  assert.deepEqual([...url.searchParams.keys()].sort(), ["context", "property", "slot"]);
});

test("campaign text cannot become HTML", async () => {
  const { host } = await render({ ...creative,
    title: "<script>danger()</script>", disclosure: "<img src=x onerror=evil()>" });
  assert.equal(host.children[1].textContent, "The publisher may receive a referral reward when you use this offer. <img src=x onerror=evil()>");
  assert.equal(host.children[2].children[0].textContent, "<script>danger()</script>");
});

test("missing disclosures, unrelated context, bad expiry and unknown kinds fail closed", async () => {
  for (const field of ["disclosure", "eligibility", "riskNotice"]) {
    assert.equal((await render({ ...creative, [field]: "" })).host.children.length, 0);
  }
  for (const [ad, context] of [
    [creative, "health"], [creative, ""],
    [{ ...creative, allowedContexts: [] }, "sport"],
    [{ ...creative, expiresAt: "2026-01-01T00:00:00Z" }, "sport"],
    [{ ...creative, expiresAt: undefined }, "sport"],
    [{ ...creative, expiresAt: "invalid" }, "sport"],
    [{ ...creative, kind: "unknown" }, "sport"],
  ]) assert.equal((await render(ad, context)).host.children.length, 0);
  assert.equal((await render(creative, "sport", "http://ads.561.group")).requests.length, 0);
});

test("Perpetuals referral requires finance-related page context", async () => {
  const perps = { ...creative, allowedContexts: ["crypto", "business-markets"],
    riskNotice: "Leveraged perpetual futures can cause substantial losses." };
  assert.equal((await render(perps, "sport")).host.children.length, 0);
  assert.equal((await render(perps, "crypto")).host.children.length, 5);
});
