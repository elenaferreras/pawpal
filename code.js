"use strict";
(() => {
  // src/code.ts
  var sw = self;
  var CACHE = "pawpal-v2";
  var APP_SHELL = "./ui.html";
  sw.addEventListener("install", () => {
    void sw.skipWaiting();
  });
  sw.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        );
        await sw.clients.claim();
      })()
    );
  });
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
      })()
    );
  });
  sw.addEventListener("push", (event) => {
    const data = (() => {
      try {
        return event.data ? event.data.json() : {};
      } catch {
        return {};
      }
    })();
    const title = data.title || "PawPal \u{1F43E}";
    const options = {
      body: data.body || "New activity from your sitter.",
      tag: data.tag || "sitter-activity",
      icon: "./icon-192.png",
      badge: "./icon-192.png"
    };
    event.waitUntil(sw.registration.showNotification(title, options));
  });
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
      })()
    );
  });
})();
