/**
 * Search for sign/guid/restapi/encrypt etc. in saved JS files; print line numbers and context.
 * Usage:
 *   pnpm exec tsx scripts/search-sign-in-js.ts [path-or-dir]
 *   pnpm exec tsx scripts/search-sign-in-js.ts ./17track-scripts-dump
 *   pnpm exec tsx scripts/search-sign-in-js.ts ./17track-scripts-dump/xxx.js
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const KEYWORDS = ["sign", "guid", "restapi", "timeZoneOffset", "encrypt", "hmac", "sha", "md5", "btoa", "encode"];

function searchFile(filePath: string) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  const name = filePath.replace(/^.*[/\\]/, "");
  let found = false;
  KEYWORDS.forEach((kw) => {
    lines.forEach((line, i) => {
      if (!line.includes(kw)) return;
      found = true;
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 2);
      const snippet = lines.slice(start, end).map((l, j) => `${start + j + 1}: ${l.trim().slice(0, 150)}`).join("\n");
      console.log(`\n--- ${name} (${kw}) L${i + 1} ---\n${snippet}`);
    });
  });
  return found;
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith(".js")) files.push(full);
  }
  return files;
}

const input = process.argv[2] || "./17track-scripts-dump";
let toSearch: string[] = [];
try {
  const stat = statSync(input);
  toSearch = stat.isDirectory() ? walk(input) : [input];
} catch (e) {
  console.error("Path not found:", input, (e as Error).message);
  process.exit(1);
}
console.log("Searching in:", toSearch.length, "file(s)");
toSearch.forEach((f) => searchFile(f));
