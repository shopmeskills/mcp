# 17track restapi sign — reverse-engineering notes

## Current findings (after dump + layout analysis)

- Opening `https://t.17track.net/en` **redirects to** `https://www.17track.net/en`, so fetched scripts are from **www** Next.js.
- The strings `restapi` or `track/restapi` **do not appear** in the fetched scripts, so either:
  - restapi is called from **t.17track.net** frontend only (iframe or another bundle not in this dump), or
  - The request URL is obfuscated/constructed (e.g. from variables or arrays).
- Chunk **5730** contains `timeZoneOffset:-480` and `msgapi`, `userapi` config; interface logic lives there, but **restapi sign is likely in another chunk or loaded dynamically**.

### Sign source (confirmed from layout chunk)

- **Script**: `layout-5ee15cecd9704ee7.js` (URL like `https://static.17track.net/t/2026-02/_next/static/chunks/app/%5Blang%5D/layout-...js`)
- **sign**: In `createRequestData`, `sign = await this.fingerPrinter.getFingerprint()`
- **fingerPrinter**: `new B.Up({ maxMovePoints: 0, obfuscate: V.Br })`
  - **B.Up**: chunk **276** (`276-9c40f7e193badc1b.js`), loads by `obfuscate` branch:
    - **obfuscate === true** (17track): loads chunk **839** (`ff19fa74.572f7423d0162d32.js`), module **4279**, **WASM** (Rust/wasm-bindgen) + 75 browser API deps (canvas, navigator, screen, crypto, etc.), exports `get_fingerprint`.
    - **obfuscate === false**: loads chunk **211**, module **70134**.
  - **obfuscate: V.Br**: In chunk **22807**, `Br = true`, `v8 = { _YQ_RC_: "_yq_rc_" }` (boolean true, no extra obfuscation).
- **guid**: First request can send `""`; server returns `guid` in restapi response for later requests.
- **Last-Event-Id**: Optional request header, related to cookie `_yq_rc_`.

Suggestion: In the browser, set an XHR/fetch breakpoint on **t.17track.net/track/restapi**, check the call stack for which script and line send the request, then find where sign is generated in that script.

---

## 1. Fetch frontend scripts and locate sign

From `packages/logistics-tracking-mcp` (Puppeteer optional):

```bash
pnpm add puppeteer   # if needed
pnpm exec tsx scripts/fetch-17track-chunks.ts
```

This produces `17track-scripts-dump/`:

- All requested scripts saved as `.js` files
- `sign-hits.txt` lists scripts and line snippets containing `sign`

## 2. Locate sign generation in the browser

1. Open https://t.17track.net/en, F12 → Network, enable Preserve log.
2. Filter by `restapi`, enter a tracking number and click Track.
3. Find the `restapi` POST request; in Payload you see `data`, `guid`, `timeZoneOffset`, `sign`.
4. In Sources, Ctrl+Shift+F (global search) for `"sign"` or `sign:` or `.sign=`, set a breakpoint where the request body is built or sign is set (or use Network → right‑click request → Break on → XHR/fetch breakpoint).
5. When it breaks, inspect the call stack to see what assigns sign and what calls the crypto function; note function names or patterns (e.g. `_0x1234`, `encrypt`, `h`).
6. Search the dumped main bundle (usually the largest `.js`) for that name/pattern to find the sign computation.

## 3. Common obfuscation and approaches

- **Variable name obfuscation**: e.g. `_0x4a2b`; use breakpoints to observe inputs/outputs and call relationships.
- **Control-flow flattening**: large switch/case; use [de4js](https://lelinhtinh.github.io/de4js/) or follow one path by hand.
- **String array + index**: search for `sign`, `guid`, `restapi`, `data`, then see who references them to infer functions.
- **Crypto usage**: search for `CryptoJS`, `encrypt`, `hmac`, `sha`, `md5`, `btoa`; sign is often:
  - HMAC-SHA256 / MD5 of `data + guid + timeZoneOffset` (or similar), then Base64; or
  - JSON.stringify then encrypt then encode.

## 4. Replicating in Node (no Puppeteer)

The project previously had a Node-only path (removed). For no-key tracking we now use **Playwright** to load 17track and intercept the restapi response; no sign replication in Node.

## 5. Notes

- 17track may change algorithms or add checks over time; reverse-engineering is for learning/local use only; respect ToS and compliance.
- If you only need “get tracking data” and can use a browser, the current approach (Playwright + response interception) works without reversing sign.
