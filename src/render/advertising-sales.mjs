/** Publisher-facing advertising opportunities from configured, actual channels.
 * This page is a solicitation to enquire, not a live campaign sale or a
 * representation that a slot has impressions, approvals, or a fixed price.
 */
import { escapeHtml } from "./markdown.mjs";

const SLOT_NAMES = Object.freeze({
  header: "Above the article or front page",
  inArticle: "Within articles",
  afterArticle: "After articles",
  footer: "At the end of pages",
});

export function advertisingInventory(property) {
  const house = property?.monetization?.houseAds;
  const houseSlots = typeof house?.server === "string" && house.server.trim() &&
    Array.isArray(house.slots)
    ? [...new Set(house.slots.filter(slot => typeof slot === "string" && slot.trim()))]
    : [];
  const aads = property?.monetization?.aads?.units;
  const aadsUnits = Array.isArray(aads)
    ? [...new Set(aads.filter(unit => typeof unit === "string" && /^\d+$/u.test(unit)))]
    : [];
  return { houseSlots, aadsUnits };
}

export function hasAdvertisingInventory(property) {
  const { houseSlots, aadsUnits } = advertisingInventory(property);
  return houseSlots.length > 0 || aadsUnits.length > 0;
}

export function renderAdvertisingSales(property) {
  const { houseSlots, aadsUnits } = advertisingInventory(property);
  if (houseSlots.length === 0 && aadsUnits.length === 0) return null;
  const esc = escapeHtml;
  const body = [
    `<p>${esc(property.name)} publishes independently edited reporting. Advertising is separate from editorial selection, factual corrections, and coverage decisions.</p>`,
  ];
  if (houseSlots.length) {
    const slots = houseSlots.map(slot =>
      `<li>${esc(SLOT_NAMES[slot] ?? slot)}</li>`).join("");
    body.push(
      `<h2>First-party contextual placements</h2>`,
      `<p>The publisher has configured first-party placements for these positions:</p><ul>${slots}</ul>`,
      `<p>Creative selection uses the page's declared subject, not a reader profile. Sponsored and affiliate offers carry visible material-connection disclosures and must be accepted before serving. A configured position is not a guaranteed impression or an accepted paid campaign.</p>`,
      `<p>To propose a placement, <a href="https://561.group/contact/">contact the 561 Group</a> with the offer, landing page, intended topic, terms, and proposed budget. This begins an inquiry, not a purchase or an automatic advertising contract.</p>`,
    );
  }
  if (aadsUnits.length) {
    const unitList = aadsUnits.map(unit =>
      `<li><a href="https://aads.com/ad_units/${encodeURIComponent(unit)}">AADS unit ${esc(unit)}</a></li>`).join("");
    body.push(
      `<h2>A-Ads network placements</h2>`,
      `<p>Advertisers can buy placements through <a href="https://aads.com/">A-Ads</a>. ${esc(property.name)} does not take payment for those units directly.</p>`,
      `<p>To target this publication, create an A-Ads campaign and select these units in the provider's targeting controls:</p><ul>${unitList}</ul>`,
      `<p>Placement and delivery depend on the provider's actual campaign settings and eligible traffic. <a href="https://help.aads.com/en/article/how-to-adjust-campaign-targeting-1f1uxah/">Read the provider's targeting instructions</a>.</p>`,
    );
  }
  body.push(`<p>Advertising cannot buy editorial coverage. Our <a href="/standards/">editorial standards</a> and <a href="/corrections/">corrections policy</a> apply regardless of sponsor.</p>`);
  return body.join("");
}
