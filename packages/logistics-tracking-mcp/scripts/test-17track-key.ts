/**
 * Test whether the 17track API key is valid.
 * Usage: pnpm exec tsx scripts/test-17track-key.ts [API_KEY]
 * If no key is passed, reads from env TRACK17_API_KEY.
 */

const API_KEY =
  process.argv[2] || process.env.TRACK17_API_KEY || "671C9376D6E7937B3C90FDE45C046B90";
const TEST_NUMBER = "LX123456789CN"; // Sample number, only used to verify API connectivity

async function test17trackKey() {
  console.log("Testing 17track API with key:", API_KEY ? `${API_KEY.slice(0, 8)}...` : "(none)");
  console.log("Test tracking number:", TEST_NUMBER);
  console.log("");

  // Step 1: Register
  console.log("1. POST register...");
  const registerRes = await fetch("https://api.17track.net/track/v2.2/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "17token": API_KEY,
    },
    body: JSON.stringify([{ number: TEST_NUMBER }]),
    signal: AbortSignal.timeout(15000),
  });

  const registerBody = await registerRes.text();
  let registerJson: { code?: number; message?: string; data?: unknown };
  try {
    registerJson = JSON.parse(registerBody) as { code?: number; message?: string; data?: unknown };
  } catch {
    registerJson = {};
  }

  console.log("   Status:", registerRes.status, registerRes.statusText);
  console.log("   Body:", registerBody.slice(0, 500));
  console.log("");

  if (!registerRes.ok) {
    console.log("Result: FAIL — register returned non-OK status");
    return;
  }

  if (registerJson.code !== 0 && registerJson.code !== undefined) {
    console.log("Result: API returned code", registerJson.code, registerJson.message || "");
    if (registerJson.code === 401 || registerJson.message?.toLowerCase().includes("token") || registerJson.message?.toLowerCase().includes("key")) {
      console.log("→ Key may be invalid or expired. Check or re-apply at https://api.17track.net");
    }
    return;
  }

  await new Promise((r) => setTimeout(r, 1500));

  // Step 2: Get track info
  console.log("2. POST gettrackinfo...");
  const getRes = await fetch("https://api.17track.net/track/v2.2/gettrackinfo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "17token": API_KEY,
    },
    body: JSON.stringify([{ number: TEST_NUMBER }]),
    signal: AbortSignal.timeout(15000),
  });

  const getBody = await getRes.text();
  let getJson: { code?: number; message?: string; data?: unknown };
  try {
    getJson = JSON.parse(getBody) as { code?: number; message?: string; data?: unknown };
  } catch {
    getJson = {};
  }

  console.log("   Status:", getRes.status, getRes.statusText);
  console.log("   Body:", getBody.slice(0, 800));
  console.log("");

  if (!getRes.ok) {
    console.log("Result: FAIL — gettrackinfo returned non-OK status");
    return;
  }

  if (getJson.code === 0) {
    console.log("Result: OK — This key can call 17track API successfully.");
  } else {
    console.log("Result: API code =", getJson.code, getJson.message || "");
    if (getJson.code === 401 || getJson.message?.toLowerCase().includes("token")) {
      console.log("→ Key may be invalid or expired.");
    }
  }
}

test17trackKey().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
