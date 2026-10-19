/**
 * First-party house-ad loader. The publisher provides slot, context and ad
 * server; the server remains the authority for campaign selection, redirect
 * destinations, expiry and aggregate counters. No visitor profile is read.
 *
 * The same browser function is serialized into the static asset; tests can
 * execute that actual asset without maintaining a second implementation.
 */
export function mountHouseAds() {
  const slots = document.querySelectorAll(".ad-slot[data-ad-server]");
  for (const el of slots) {
    const { adServer, slot, property, context = "" } = el.dataset;
    if (!adServer || !slot || !property) continue;

    // Only the configured HTTPS house server can receive ad requests or clicks.
    let origin;
    try {
      const url = new URL(adServer);
      if (url.protocol !== "https:" || url.username || url.password ||
          url.search || url.hash || url.pathname !== "/") continue;
      origin = url.origin;
    } catch {
      continue;
    }

    const args = "slot=" + encodeURIComponent(slot) +
      "&property=" + encodeURIComponent(property) +
      (context ? "&context=" + encodeURIComponent(context) : "");
    fetch(origin + "/ad?" + args, { credentials: "omit" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const creative = data?.creative;
        if (!creative || !["string", "number"].includes(typeof creative.id) || !String(creative.id).trim() ||
            typeof creative.title !== "string" || !creative.title) return;

        // Consume the original ad server's canonical relationship, not an
        // unrelated "kind" default that could mislabel a paid ad as house.
        const relationship = creative.relationship;
        if (!["house", "affiliate", "sponsored"].includes(relationship)) return;
        const paid = relationship !== "house";
        if (paid) {
          if (typeof creative.disclosure !== "string" || !creative.disclosure.trim() ||
              typeof creative.linkRel !== "string" ||
              !creative.linkRel.split(/\s+/u).includes("sponsored")) return;
          const pageContexts = new Set(context.split(",").filter(Boolean));
          if (!Array.isArray(creative.allowedContexts) ||
              !creative.allowedContexts.some(term =>
                typeof term === "string" && pageContexts.has(term))) return;
          if (typeof creative.expiresAt !== "string" ||
              !Number.isFinite(Date.parse(creative.expiresAt)) ||
              Date.parse(creative.expiresAt) <= Date.now()) return;
          if (relationship === "affiliate") {
            for (const field of ["eligibility", "riskNotice"]) {
              if (typeof creative[field] !== "string" || !creative[field].trim()) return;
            }
          }
        }

        const label = document.createElement("span");
        label.className = "ad-slot__label";
        label.textContent = relationship === "affiliate" ? "Advertisement · Referral offer" : paid ? "Advertisement" : "From the publisher";
        el.appendChild(label);

        // Put the paid material-connection disclosure BEFORE the link so it
        // is visible at the decision point, not buried in a site-wide footer.
        if (paid) {
          el.setAttribute("role", "complementary");
          el.setAttribute("aria-label", relationship === "affiliate" ? "Referral advertisement" : "Advertisement");
          const disclosure = document.createElement("p");
          disclosure.className = "ad-slot__disclosure";
          disclosure.textContent = relationship === "affiliate" ? "The publisher may receive a referral reward when you use this offer. " + creative.disclosure : creative.disclosure;
          el.appendChild(disclosure);
        }

        const link = document.createElement("a");
        link.href = origin + "/click?slot=" + encodeURIComponent(slot) +
          "&property=" + encodeURIComponent(property) +
          "&creative=" + encodeURIComponent(creative.id) +
          (paid ? "&context=" + encodeURIComponent(context) : "");
        link.rel = paid ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer";
        const title = document.createElement("strong");
        title.textContent = creative.title;
        link.appendChild(title);
        if (typeof creative.body === "string" && creative.body) {
          link.appendChild(document.createTextNode(" — " + creative.body));
        }
        el.appendChild(link);

        if (relationship === "affiliate") {
          for (const [field, className] of [
            ["eligibility", "ad-slot__eligibility"],
            ["riskNotice", "ad-slot__risk"]
          ]) {
            const notice = document.createElement("p");
            notice.className = className;
            notice.textContent = creative[field];
            el.appendChild(notice);
          }
        }
      }).catch(() => { /* No ad is safer than an inaccurate ad. */ });
  }
}

export function houseAdClientScript() {
  return "(" + mountHouseAds.toString() + ")();\n";
}
