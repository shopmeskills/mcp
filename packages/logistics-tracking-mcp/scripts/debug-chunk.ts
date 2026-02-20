/**
 * Debug: run 17track chunk 839 in jsdom with runScripts:"dangerously"
 * so that self/window/document/instanceof all work like a real browser.
 */
import { JSDOM } from "jsdom";

const CHUNK839_URL =
  "https://static.17track.net/t/2026-02/_next/static/chunks/ff19fa74.572f7423d0162d32.js";

async function main() {
  const canvasMod = await import("canvas").catch(() => null);
  const createCanvas = canvasMod
    ? (canvasMod as { createCanvas?: (w: number, h: number) => unknown }).createCanvas
    : null;

  // JSDOM with runScripts:"dangerously" — scripts run in proper browser context
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://t.17track.net/",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });
  const win = dom.window as unknown as Window & Record<string, unknown>;

  // Canvas polyfill
  if (createCanvas && win.HTMLCanvasElement) {
    const proto = win.HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
    proto.getContext = function (this: Record<string, unknown>, type: string) {
      if (type === "2d") {
        if (!this.__nc) this.__nc = createCanvas((this.width as number) ?? 300, (this.height as number) ?? 150);
        return (this.__nc as { getContext: (t: string) => unknown }).getContext("2d");
      }
      return null;
    };
    proto.toDataURL = function (this: Record<string, unknown>, mimeType?: string) {
      if (!this.__nc) this.__nc = createCanvas((this.width as number) ?? 300, (this.height as number) ?? 150);
      return (this.__nc as { toDataURL: (m?: string) => string }).toDataURL(mimeType ?? "image/png");
    };
  }

  // Patch WebAssembly on window — use Object.create to keep Module/Instance for instanceof
  const nodeWasm = globalThis.WebAssembly;
  const origInstantiate = nodeWasm.instantiate;
  const patchedWasm = Object.create(nodeWasm, {
    instantiate: {
      value: function (source: unknown, importObject?: Record<string, Record<string, (...args: unknown[]) => unknown>>) {
        // Log wbg import calls
        if (importObject) {
          for (const ns of Object.keys(importObject)) {
            const mod = importObject[ns];
            if (typeof mod !== "object" || !mod) continue;
            for (const key of Object.keys(mod)) {
              if (typeof mod[key] === "function") {
                const orig = mod[key];
                mod[key] = function (...args: unknown[]) {
                  try {
                    const r = orig.apply(this, args);
                    const display = r === null ? "null" : r === undefined ? "undef" : typeof r === "boolean" ? String(r) : typeof r;
                    console.log(`[wbg] ${key}(${args.length}) →`, display);
                    return r;
                  } catch (e) {
                    console.error(`[wbg] ${key} THREW:`, (e as Error).message);
                    throw e;
                  }
                };
              }
            }
          }
        }
        return origInstantiate.call(nodeWasm, source as BufferSource, importObject as WebAssembly.Imports);
      },
      enumerable: true,
      configurable: true,
    },
  });

  // Set WebAssembly on jsdom window (jsdom doesn't have it natively)
  win.eval(`
    // Injected by debug-chunk.ts — will be replaced
    void 0;
  `);
  // Use eval to define it in the jsdom context
  (win as Record<string, unknown>).WebAssembly = patchedWasm;

  // Other globals jsdom doesn't have
  const FakeCtx2D = class CanvasRenderingContext2D { static [Symbol.hasInstance](v: unknown) { return v != null && typeof v === "object" && "fillRect" in v; } };
  const extras: Record<string, unknown> = { TextEncoder, TextDecoder, CanvasRenderingContext2D: FakeCtx2D };
  for (const [k, v] of Object.entries(extras)) {
    if (!(k in win)) (win as Record<string, unknown>)[k] = v;
  }

  // Quick sanity check
  const selfIsWindow = win.eval("self instanceof Window");
  console.log("self instanceof Window:", selfIsWindow);

  // Fetch chunk
  const res = await fetch(CHUNK839_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36" },
    signal: AbortSignal.timeout(15000),
  });
  const chunkScript = await res.text();
  console.log("chunk length:", chunkScript.length);

  // Webpack chunk array with push interceptor
  let module4279: Record<string, unknown> | null = null;
  const dummyCtor = function () {} as unknown as new () => unknown;
  const moduleProxy = new Proxy({}, {
    get(_t, p) { return p === "__esModule" ? true : p === Symbol.hasInstance ? () => false : dummyCtor; },
  });
  const chunkArray = [] as unknown[];
  (chunkArray as Record<string, unknown>).push = function (
    data: [number[], Record<number, (m: unknown, e: Record<string, unknown>, r: unknown) => void>],
  ) {
    const [ids, modules] = data;
    console.log("push: ids", ids, "modules", Object.keys(modules || {}));
    const fn = modules?.[4279];
    if (fn) {
      const m = { exports: {} as Record<string, unknown> };
      const r = (id: number) => (id === 4279 ? m.exports : moduleProxy);
      (r as Record<string, unknown>).r = (e: unknown) => Object.defineProperty(e as object, "__esModule", { value: true });
      (r as Record<string, unknown>).d = (e: unknown, def: Record<string, () => unknown>) => {
        for (const [k, getter] of Object.entries(def)) Object.defineProperty(e as object, k, { get: getter, enumerable: true });
      };
      try {
        fn(m, m.exports, r);
        module4279 = m.exports;
        console.log("module 4279 exports:", Object.keys(m.exports));
      } catch (e) {
        console.error("module 4279 fn() threw:", e);
      }
    }
    return 1;
  };
  (win as Record<string, unknown>).webpackChunk_N_E = chunkArray;

  // Run chunk via script tag injection (proper browser-like execution context)
  const scriptEl = win.document.createElement("script");
  scriptEl.textContent = chunkScript;
  win.document.head.appendChild(scriptEl);
  console.log("script injected");

  if (!module4279) { console.log("module 4279 not found"); return; }
  console.log("default:", typeof module4279.default, "get_fingerprint:", typeof module4279.get_fingerprint);

  if (typeof module4279.default === "function") {
    console.log("\n--- default() ---");
    try {
      const r = await (module4279.default as () => Promise<unknown>)();
      console.log("returned:", r);
    } catch (e) {
      console.error("threw:", (e as Error).stack || e);
    }
  }

  if (typeof module4279.get_fingerprint === "function") {
    console.log("\n--- get_fingerprint([]) ---");
    try {
      const sign = (module4279.get_fingerprint as (p: number[]) => string)([]);
      console.log("SIGN:", sign);
    } catch (e) {
      console.error("threw:", (e as Error).stack || e);
    }
  }
}

main().catch(console.error);
