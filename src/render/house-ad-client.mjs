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

        // Unknown creative classes are never quietly treated as house ads.
        const kind = creative.kind ?? "house";
        if (kind !== "house" && kind !== "referral") return;
        if (kind === "referral") {
          // The server must declare and warrant this relationship and the
          // offer-specific eligibility/risk warnings. Incomplete ads fail shut.
          for (const field of ["disclosure", "eligibility", "riskNotice"]) {
            if (typeof creative[field] !== "string" || !creative[field].trim()) return;
          }
          const pageContexts = new Set(context.split(",").filter(Boolean));
          if (!Array.isArray(creative.allowedContexts) ||
              !creative.allowedContexts.some((term) =>
                typeof term === "string" && pageContexts.has(term))) return;
          if (typeof creative.expiresAt !== "string" ||
              !Number.isFinite(Date.parse(creative.expiresAt)) ||
              Date.parse(creative.expiresAt) <= Date.now()) return;
        }

        const label = document.createElement("span");
        label.className = "ad-slot__label";
        label.textContent = kind === "referral" ? "Advertisement · Referral offer" : "From the publisher";
        el.appendChild(label);

        // Put the paid material-connection disclosure BEFORE the link so it
        // is visible at the decision point, not buried in a site-wide footer.
        if (kind === "referral") {
          el.setAttribute("role", "complementary");
          el.setAttribute("aria-label", "Referral advertisement");
          const disclosure = document.createElement("p");
          disclosure.className = "ad-slot__disclosure";
          disclosure.textContent = "The publisher may receive a referral reward when you use this offer. " + creative.disclosure;
          el.appendChild(disclosure);
        }

        const link = document.createElement("a");
        link.href = origin + "/click?slot=" + encodeURIComponent(slot) +
          "&property=" + encodeURIComponent(property) +
          "&creative=" + encodeURIComponent(creative.id);
        link.rel = "sponsored noopener noreferrer";
        const title = document.createElement("strong");
        title.textContent = creative.title;
        link.appendChild(title);
        if (typeof creative.body === "string" && creative.body) {
          link.appendChild(document.createTextNode(" — " + creative.body));
        }
        el.appendChild(link);

        if (kind === "referral") {
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
