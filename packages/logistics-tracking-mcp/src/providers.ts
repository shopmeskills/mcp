/**
 * Tracking data providers:
 *   1. 17track official API (requires TRACK17_API_KEY)
 *   2. Playwright browser automation (no key needed, requires `playwright` + chromium)
 */

export interface TrackingResult {
  status: string;
  estimatedDelivery?: string;
  currentLocation?: string;
  timeline: TrackingEvent[];
  rawData?: unknown;
}

export interface TrackingEvent {
  time: string;
  location: string;
  description: string;
  status: string;
}

/**
 * Query tracking info via 17track API (primary).
 * Requires TRACK17_API_KEY environment variable.
 */
export async function queryTracking(
  trackingNumber: string,
  carrier: string,
  apiKey: string,
  language: string = "en",
): Promise<TrackingResult> {
  // Step 1: Register the tracking number
  const registerResponse = await fetch(
    "https://api.17track.net/track/v2.2/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": apiKey,
      },
      body: JSON.stringify([
        {
          number: trackingNumber,
          ...(carrier !== "unknown" ? { carrier_new: carrier } : {}),
        },
      ]),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!registerResponse.ok) {
    throw new Error(`17track register failed: HTTP ${registerResponse.status}`);
  }

  // Wait briefly for tracking data to be processed
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Step 2: Get tracking results
  const getTrackResponse = await fetch(
    "https://api.17track.net/track/v2.2/gettrackinfo",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": apiKey,
      },
      body: JSON.stringify([{ number: trackingNumber }]),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!getTrackResponse.ok) {
    throw new Error(
      `17track gettrackinfo failed: HTTP ${getTrackResponse.status}`,
    );
  }

  const data = (await getTrackResponse.json()) as {
    code: number;
    data: {
      accepted: Array<{
        number: string;
        track: {
          e: number;
          z0?: { a: string; c: string; z: string }[];
          z1?: { a: string; c: string; z: string }[];
        };
      }>;
    };
  };

  if (data.code !== 0 || !data.data?.accepted?.length) {
    throw new Error("No tracking data returned from 17track");
  }

  const trackInfo = data.data.accepted[0];
  const events: TrackingEvent[] = [];

  // Parse origin country events (z0)
  if (trackInfo.track?.z0) {
    for (const event of trackInfo.track.z0) {
      events.push({
        time: event.a,
        location: event.c || "Origin",
        description: event.z,
        status: "origin",
      });
    }
  }

  // Parse destination country events (z1)
  if (trackInfo.track?.z1) {
    for (const event of trackInfo.track.z1) {
      events.push({
        time: event.a,
        location: event.c || "Destination",
        description: event.z,
        status: "destination",
      });
    }
  }

  // Sort by time descending (newest first)
  events.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );

  const statusMap: Record<number, string> = {
    0: "InfoReceived",
    10: "InTransit",
    20: "CustomsClearance",
    30: "PickedUp",
    35: "OutForDelivery",
    40: "Delivered",
    50: "Exception",
    60: "Returned",
  };

  return {
    status: statusMap[trackInfo.track?.e ?? 0] || "Unknown",
    currentLocation: events[0]?.location,
    timeline: events,
  };
}

/**
 * No-Key tracking via Playwright (real browser).
 * Playwright navigates to 17track and intercepts the API response,
 * bypassing all anti-bot checks that pure Node.js cannot pass.
 */
export async function queryTrackingNoKey(
  trackingNumber: string,
  _language: string = "en",
): Promise<TrackingResult> {
  try {
    const { queryTrackingWithPlaywright, isPlaywrightAvailable } = await import("./17track-playwright.js");

    if (!await isPlaywrightAvailable()) {
      return {
        status: "SetupRequired",
        timeline: [],
        rawData: {
          error: "playwright_not_installed",
          setup: [
            "npm install playwright",
            "npx playwright install chromium",
          ],
          note: "No TRACK17_API_KEY configured. To track without an API key, install Playwright (a headless browser). Run the two commands above, then try again.",
          webUrl: `https://t.17track.net/en#nums=${trackingNumber}`,
        },
      };
    }

    const result = await queryTrackingWithPlaywright(trackingNumber);
    if (result) return result;

    return {
      status: "Unknown",
      timeline: [],
      rawData: {
        note: `Playwright tracking returned no data. Try: https://t.17track.net/en#nums=${trackingNumber}`,
        webUrl: `https://t.17track.net/en#nums=${trackingNumber}`,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
      return {
        status: "SetupRequired",
        timeline: [],
        rawData: {
          error: "playwright_not_installed",
          setup: [
            "npm install playwright",
            "npx playwright install chromium",
          ],
          note: "Playwright is not installed. Run the commands above to enable no-key tracking.",
          webUrl: `https://t.17track.net/en#nums=${trackingNumber}`,
        },
      };
    }
    return {
      status: "Unknown",
      timeline: [],
      rawData: {
        note: `Tracking error: ${msg}`,
        webUrl: `https://t.17track.net/en#nums=${trackingNumber}`,
      },
    };
  }
}
