/**
 * US domestic tracking via official APIs only (USPS, UPS).
 * No 17track, RTB56, or other third-party aggregators.
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

const STATUS_MAP: Record<number, string> = {
  0: "InfoReceived",
  10: "InTransit",
  20: "CustomsClearance",
  30: "PickedUp",
  35: "OutForDelivery",
  40: "Delivered",
  50: "Exception",
  60: "Returned",
};

/** Get UPS OAuth token (client credentials). */
async function getUpsToken(clientId: string, clientSecret: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://onemap.ups.com/security/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`UPS OAuth failed: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("UPS OAuth: no access_token");
  return data.access_token;
}

/** Query UPS Track API (official). */
export async function queryUps(
  trackingNumber: string,
  clientId: string,
  clientSecret: string,
): Promise<TrackingResult> {
  const token = await getUpsToken(clientId, clientSecret);
  const url = `https://onemap.ups.com/api/track/v1/details/${encodeURIComponent(trackingNumber)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 404) {
      return { status: "Unknown", timeline: [], rawData: { note: "Tracking number not found in UPS." } };
    }
    throw new Error(`UPS Track API failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    trackResponse?: {
      shipment?: Array<{
        package?: {
          activity?: Array<{
            date?: string;
            time?: string;
            location?: { address?: { city?: string; stateProvinceCode?: string; country?: string } };
            status?: { description?: string; type?: string };
          }>;
        };
      }>;
    };
  };
  const shipment = data.trackResponse?.shipment?.[0];
  const pkg = shipment?.package;
  const activities = pkg?.activity ?? [];
  const timeline: TrackingEvent[] = activities.map((a) => ({
    time: [a.date, a.time].filter(Boolean).join(" "),
    location: a.location?.address
      ? [a.location.address.city, a.location.address.stateProvinceCode, a.location.address.country].filter(Boolean).join(", ")
      : "Unknown",
    description: a.status?.description ?? "",
    status: a.status?.type ?? "transit",
  }));
  const latest = activities[0];
  const statusDesc = latest?.status?.description ?? "";
  let status = "InTransit";
  if (/delivered|delivery/i.test(statusDesc)) status = "Delivered";
  else if (/out for delivery/i.test(statusDesc)) status = "OutForDelivery";
  else if (/exception|problem/i.test(statusDesc)) status = "Exception";
  else if (/pickup|picked up/i.test(statusDesc)) status = "PickedUp";

  return {
    status,
    currentLocation: timeline[0]?.location,
    timeline,
    rawData: data,
  };
}

/** Get USPS OAuth token (client credentials). Base URL: apis.usps.com or apis-tem.usps.com for test. */
async function getUspsToken(consumerKey: string, consumerSecret: string, baseUrl: string): Promise<string> {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(`${baseUrl}/oauth2/v3/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`USPS OAuth failed: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("USPS OAuth: no access_token");
  return data.access_token;
}

/**
 * Query USPS Tracking 3.2 (official).
 * Docs: https://developers.usps.com (Tracking 3.2). Endpoint/path may vary by portal version.
 */
export async function queryUsps(
  trackingNumber: string,
  consumerKey: string,
  consumerSecret: string,
  useTestEnv = false,
): Promise<TrackingResult> {
  const baseUrl = useTestEnv ? "https://apis-tem.usps.com" : "https://apis.usps.com";
  const token = await getUspsToken(consumerKey, consumerSecret, baseUrl);
  // Override via env if your USPS portal uses a different path (see developers.usps.com)
  const path = process.env.USPS_TRACK_PATH ?? "tracking/v3/track";
  const trackUrl = `${baseUrl}/${path.replace(/^\//, "")}?trackingNumber=${encodeURIComponent(trackingNumber)}`;
  const res = await fetch(trackUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 404) {
      return { status: "Unknown", timeline: [], rawData: { note: "Tracking number not found in USPS." } };
    }
    const text = await res.text();
    return {
      status: "Unknown",
      timeline: [],
      rawData: {
        note: "USPS API returned an error. Ensure Tracking 3.2 is enabled and endpoint matches developers.usps.com.",
        status: res.status,
        body: text.slice(0, 500),
      },
    };
  }
  const data = (await res.json()) as Record<string, unknown>;
  // Normalize USPS response to TrackingResult (structure depends on actual API; adjust as needed)
  const events = (data.events as Array<{ date?: string; location?: string; description?: string }>) ?? [];
  const timeline: TrackingEvent[] = events.map((e) => ({
    time: e.date ?? "",
    location: (e.location as string) ?? "Unknown",
    description: (e.description as string) ?? "",
    status: "transit",
  }));
  const status = (data.status as string) ?? "InTransit";
  return {
    status: status in STATUS_MAP ? status : "InTransit",
    currentLocation: timeline[0]?.location,
    timeline,
    rawData: data,
  };
}

/** Route to the correct official API; no fallback to 17track/RTB56. */
export async function queryTracking(
  trackingNumber: string,
  carrier: string,
  env: {
    USPS_CONSUMER_KEY?: string;
    USPS_CONSUMER_SECRET?: string;
    UPS_CLIENT_ID?: string;
    UPS_CLIENT_SECRET?: string;
    USPS_USE_TEST_ENV?: string;
  },
): Promise<TrackingResult> {
  if (carrier === "ups") {
    const id = env.UPS_CLIENT_ID;
    const secret = env.UPS_CLIENT_SECRET;
    if (!id || !secret) {
      return {
        status: "Unknown",
        timeline: [],
        rawData: {
          note: "UPS credentials not set. Set UPS_CLIENT_ID and UPS_CLIENT_SECRET (developer.ups.com).",
        },
      };
    }
    return queryUps(trackingNumber, id, secret);
  }

  if (carrier === "usps") {
    const key = env.USPS_CONSUMER_KEY;
    const secret = env.USPS_CONSUMER_SECRET;
    if (!key || !secret) {
      return {
        status: "Unknown",
        timeline: [],
        rawData: {
          note: "USPS credentials not set. Set USPS_CONSUMER_KEY and USPS_CONSUMER_SECRET (developers.usps.com).",
        },
      };
    }
    return queryUsps(trackingNumber, key, secret, env.USPS_USE_TEST_ENV === "true");
  }

  if (carrier === "fedex") {
    return {
      status: "Unknown",
      timeline: [],
      rawData: {
        note: "FedEx API not implemented in this server. Use UPS or USPS, or integrate FedEx API separately.",
      },
    };
  }

  return {
    status: "Unknown",
    timeline: [],
    rawData: {
      note: `Unsupported or unknown carrier: ${carrier}. This server supports US domestic UPS and USPS only.`,
      supportedCarriers: ["usps", "ups"],
    },
  };
}
