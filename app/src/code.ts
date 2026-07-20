/// <reference lib="webworker" />

// ─────────────────────────────────────────────────────────────
// PawPal service worker sandbox — ported from the original sw.js.
// This is the "sandbox" tier of the app: it runs in a separate
// worker context from the React UI (src/ui/) and handles the
// offline app-shell cache and native notification routing.
//
// Built by esbuild → dist/code.js (IIFE, no module imports).
// ─────────────────────────────────────────────────────────────

export {};

const sw = self as unknown as ServiceWorkerGlobalScope & typeof globalThis;

const CACHE = "pawpal-v2";
const APP_SHELL = "./ui.html";

sw.addEventListener("install", () => {
  // Activate immediately, replacing any previous worker.
  void sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop stale caches from earlier versions.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await sw.clients.claim();
    })(),
  );
});

// Network-first for navigations, falling back to the cached app shell
// so the app keeps opening while offline.
sw.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE);
        void cache.put(APP_SHELL, response.clone());
        return response;
      } catch {
        const cached = await caches.match(APP_SHELL);
        return cached ?? Response.error();
      }
    })(),
  );
});

// Focus (or open) the app when a notification is clicked.
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const list = await sw.clients.matchAll({ type: "window" });
      const client = list[0];
      if (client) {
        await client.focus();
        return;
      }
      await sw.clients.openWindow(APP_SHELL);
    })(),
  );
});
