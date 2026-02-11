/**
 * Tracking data providers: 17track API + RTB56 fallback.
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
          carrier: carrier !== "unknown" ? undefined : undefined,
        },
      ]),
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
 * Fallback: Query tracking via RTB56 (no API key needed).
 */
export async function queryTrackingFallback(
  trackingNumber: string,
  language: string = "en",
): Promise<TrackingResult> {
  try {
    const queryUrl = "http://gdyy.rtb56.com/track_query.aspx";

    const formData = new URLSearchParams();
    formData.append("txtOrderNo", trackingNumber);
    formData.append("language", language === "zh" ? "zh-CN" : "en-US");

    const response = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`RTB56 query failed: HTTP ${response.status}`);
    }

    const html = await response.text();
    const events = parseRTB56Html(html);

    return {
      status: events.length > 0 ? "InTransit" : "InfoReceived",
      currentLocation: events[0]?.location,
      timeline: events,
    };
  } catch {
    // If RTB56 also fails, return a helpful message
    return {
      status: "Unknown",
      timeline: [],
      rawData: {
        note: "Could not query tracking info. Set TRACK17_API_KEY env var for best results, or try https://t.17track.net/en#nums=" +
          trackingNumber,
      },
    };
  }
}

/**
 * Parse RTB56 HTML response to extract tracking events.
 */
function parseRTB56Html(html: string): TrackingEvent[] {
  const events: TrackingEvent[] = [];

  // Match table rows with tracking data
  const rowRegex =
    /<tr[^>]*>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const time = match[1]?.trim();
    const location = match[2]?.trim();
    const description = match[3]?.trim();

    if (time && description) {
      events.push({
        time,
        location: location || "Unknown",
        description,
        status: "transit",
      });
    }
  }

  return events;
}
