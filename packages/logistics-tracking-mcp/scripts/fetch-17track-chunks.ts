/**
 * Fetch 17track frontend chunks (Node fetch only, no Puppeteer).
 * Used for reverse-engineering to obtain layout, 276, 839, etc.
 *
 * Run: pnpm exec tsx scripts/fetch-17track-chunks.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://t.17track.net";
const OUT = join(process.cwd(), "17track-chunks");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const htmlRes = await fetch(`${BASE}/en`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36" },
  });
  const html = await htmlRes.text();
  writeFileSync(join(OUT, "en.html"), html, "utf8");
  const scriptUrls = [...html.matchAll(/src="(https:\/\/static\.17track\.net[^"]+\.js)"/g)].map((m) => m[1]);
  const seen = new Set<string>();
  for (const url of scriptUrls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const name = url.replace(/https:\/\/static\.17track\.net\/[^/]+\/_next\/static\/chunks\//, "").replace(/[/%]/g, "_").slice(0, 80) + ".js";
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const text = await res.text();
      writeFileSync(join(OUT, name), text, "utf8");
      console.log("OK", name);
    } catch (e) {
      console.error("FAIL", url, (e as Error).message);
    }
  }
  console.log("Done.", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
