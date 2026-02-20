/**
 * Experimental script: 17track restapi sign/fingerprint (Node only). For reverse-engineering only.
 *
 * For normal tracking, set TRACK17_API_KEY and use MCP track_package (official api.17track.net, no sign needed).
 * This script calls t.17track.net restapi; the server validates sign and may reject our sign (code -11).
 *
 * Run: pnpm exec tsx scripts/get-17track-sign.ts [restapi]
 *
 * Note: This script is deprecated. The fingerprint/WASM modules were removed; use Playwright for no-key tracking.
 */

async function main() {
  const mode = process.argv[2] || "sign";
  console.log("Tip: For normal tracking, set TRACK17_API_KEY and use the track_package tool.\n");
  console.log("This script is deprecated (fingerprint modules removed). Use Playwright for no-key tracking.");
  if (mode === "restapi") {
    console.log("\n--- POST track/restapi (experimental, no Key) ---");
    console.log("Use the MCP server with Playwright instead.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
