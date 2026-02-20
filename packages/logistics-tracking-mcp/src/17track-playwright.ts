/**
 * Playwright-based 17track tracking: uses a real Chromium browser to bypass
 * anti-bot checks (sign, captcha, Cloudflare) that pure Node.js cannot pass.
 *
 * Key techniques:
 *   - Anti-detection: removes navigator.webdriver, suppresses automation signals
 *   - Network interception: captures restapi responses with valid tracking data
 *   - DOM fallback: scrapes rendered page if network interception misses data
 *
 * Playwright is an optional dependency — returns null if not installed.
 */

import type { TrackingResult, TrackingEvent } from "./providers.js";

interface PlaywrightBrowser {
  newContext(opts?: Record<string, unknown>): Promise<PlaywrightContext>;
  close(): Promise<void>;
  isConnected(): boolean;
}

interface PlaywrightContext {
  addInitScript(script: string | { path: string }): Promise<void>;
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightPage {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForResponse(
    predicate: (res: { url(): string; status(): number }) => boolean,
    opts?: { timeout?: number },
  ): Promise<{ json(): Promise<unknown>; status(): number }>;
  waitForSelector(selector: string, opts?: { timeout?: number; state?: string }): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
  isClosed(): boolean;
}

let _browser: PlaywrightBrowser | null = null;
let _browserPromise: Promise<PlaywrightBrowser | null> | null = null;

const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-infobars",
];

async function getBrowser(): Promise<PlaywrightBrowser | null> {
  if (_browser?.isConnected()) return _browser;
  if (_browserPromise) return _browserPromise;

  _browserPromise = (async () => {
    try {
      const pw = await import("playwright");
      const chromium = (pw as unknown as {
        chromium: { launch: (opts?: Record<string, unknown>) => Promise<PlaywrightBrowser> };
      }).chromium;
      _browser = await chromium.launch({
        headless: true,
        args: STEALTH_ARGS,
      });
      return _browser;
    } catch {
      _browser = null;
      return null;
    } finally {
      _browserPromise = null;
    }
  })();

  return _browserPromise;
}

const STEALTH_INIT_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5].map(() => ({ length: 1 })),
  });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  window.chrome = { runtime: {} };
  const origQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (params) =>
    params.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : origQuery.call(window.navigator.permissions, params);
`;

const RESTAPI_STATUS_MAP: Record<number, string> = {
  0: "InfoReceived",
  10: "InTransit",
  20: "CustomsClearance",
  30: "PickedUp",
  35: "OutForDelivery",
  40: "Delivered",
  50: "Exception",
  60: "Returned",
};

function parseTrackFromRestApi(data: unknown, trackingNumber: string): TrackingResult | null {
  const body = data as {
    dat?: {
      track?: {
        e?: number;
        z0?: { a: string; c: string; z: string }[];
        z1?: { a: string; c: string; z: string }[];
      };
    };
    meta?: { code?: number };
  };

  const track = body.dat?.track;
  if (!track) return null;

  const events: TrackingEvent[] = [];
  for (const ev of track.z0 ?? []) {
    events.push({ time: ev.a, location: ev.c || "Origin", description: ev.z, status: "origin" });
  }
  for (const ev of track.z1 ?? []) {
    events.push({ time: ev.a, location: ev.c || "Destination", description: ev.z, status: "destination" });
  }
  if (events.length === 0) return null;

  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return {
    status: RESTAPI_STATUS_MAP[track.e ?? 0] ?? "Unknown",
    currentLocation: events[0]?.location,
    timeline: events,
    rawData: { source: "playwright", trackingNumber },
  };
}

/**
 * Extract tracking events from the rendered DOM as a fallback when
 * network interception doesn't yield usable data.
 */
async function scrapeTrackingFromPage(page: PlaywrightPage, trackingNumber: string): Promise<TrackingResult | null> {
  try {
    await page.waitForSelector(".track-detail, .trk-list, .shipment-info, [class*='track']", {
      timeout: 8000,
      state: "attached",
    });

    const scraped = await page.evaluate(() => {
      const events: { time: string; location: string; description: string }[] = [];

      document.querySelectorAll(".trk-list li, .track-detail .event, [class*='track-event']").forEach((el) => {
        const time = el.querySelector("time, .time, [class*='time']")?.textContent?.trim() ?? "";
        const loc = el.querySelector(".location, [class*='location']")?.textContent?.trim() ?? "";
        const desc = el.querySelector(".desc, .description, [class*='desc']")?.textContent?.trim() ?? el.textContent?.trim() ?? "";
        if (desc) events.push({ time, location: loc, description: desc });
      });

      const statusEl = document.querySelector(".status, [class*='status-text'], [class*='track-status']");
      const status = statusEl?.textContent?.trim() ?? "";

      return { events, status };
    });

    if (scraped.events.length === 0) return null;

    return {
      status: scraped.status || "InTransit",
      currentLocation: scraped.events[0]?.location,
      timeline: scraped.events.map((ev) => ({
        time: ev.time,
        location: ev.location,
        description: ev.description,
        status: "transit",
      })),
      rawData: { source: "playwright-dom", trackingNumber },
    };
  } catch {
    return null;
  }
}

/**
 * Track a package using Playwright by navigating to 17track.
 * Strategy:
 *   1. Intercept restapi responses — collect any that contain tracking data
 *   2. Wait for the page to settle, then check if we got good data
 *   3. If not, try DOM scraping as fallback
 * Returns null only if Playwright is unavailable.
 */
export async function queryTrackingWithPlaywright(
  trackingNumber: string,
  options: { timeout?: number } = {},
): Promise<TrackingResult | null> {
  const timeout = options.timeout ?? 30000;

  const browser = await getBrowser();
  if (!browser) return null;

  let context: PlaywrightContext | null = null;
  let page: PlaywrightPage | null = null;

  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });

    await context.addInitScript(STEALTH_INIT_SCRIPT);
    page = await context.newPage();

    let bestResult: TrackingResult | null = null;
    let lastMetaCode: number | undefined;

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/track/restapi") && res.status() === 200,
      { timeout },
    );

    await page.goto(`https://t.17track.net/en#nums=${trackingNumber}`, {
      waitUntil: "domcontentloaded",
      timeout,
    });

    try {
      const response = await responsePromise;
      const json = await response.json();
      const parsed = parseTrackFromRestApi(json, trackingNumber);
      if (parsed) bestResult = parsed;
      lastMetaCode = (json as { meta?: { code?: number } }).meta?.code;
    } catch { /* timeout or parse error — will try DOM */ }

    if (bestResult) return bestResult;

    const domResult = await scrapeTrackingFromPage(page, trackingNumber);
    if (domResult) return domResult;

    const isSuccess = lastMetaCode === 0 || lastMetaCode === 200;
    return {
      status: isSuccess ? "NotFound" : "Unknown",
      timeline: [],
      rawData: {
        source: "playwright",
        note: isSuccess
          ? `该单号暂无物流轨迹，可能尚未揽收或单号有误`
          : `restapi 返回 code ${lastMetaCode ?? "unknown"}`,
        webUrl: `https://t.17track.net/en#nums=${trackingNumber}`,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
      return null;
    }
    return {
      status: "Unknown",
      timeline: [],
      rawData: {
        source: "playwright",
        note: `Playwright error: ${msg}`,
        webUrl: `https://t.17track.net/en#nums=${trackingNumber}`,
      },
    };
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

/** Check if Playwright is available (installed and browsers downloaded). */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    const pw = await import("playwright");
    return !!(pw as { chromium?: unknown }).chromium;
  } catch {
    return false;
  }
}

/** Shut down the shared browser instance (call on process exit). */
export async function closeBrowser(): Promise<void> {
  if (_browser?.isConnected()) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}
