#!/usr/bin/env node
/** Executable hireable discovery-assessment operation; no external dependencies. */
import { auditDiscovery } from "../src/discovery-audit.mjs";

async function main(args = process.argv.slice(2)) {
  const origin = args.find((arg) => !arg.startsWith("--")) ?? "https://koios.news";
  const strict = args.includes("--strict");
  const profile = args.includes("--profile") ? args[args.indexOf("--profile") + 1] : "news";
  const cadenceOption = args.find(arg=>arg.startsWith("--daily-article-target="));
  const dailyArticleTarget = cadenceOption===undefined?undefined:Number(cadenceOption.slice("--daily-article-target=".length));
  const report = await auditDiscovery({ origin, profile, ...(dailyArticleTarget===undefined?{}:{dailyArticleTarget}) });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (strict) {
    if (report.decision.criticalFailures.length) process.exitCode = 2;
    else if (report.decision.criticalUnknowns.length) process.exitCode = 3;
    else if (report.decision.publicationCadence.status === "fail") process.exitCode = 4;
    else if (report.decision.publicationCadence.status === "unknown") process.exitCode = 5;
  }
}

main().catch((error) => {
  process.stderr.write("publisher-discovery-assessment: " + (error?.message ?? String(error)) + "\n");
  process.exitCode = 64;
});
