import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-butter/theme.css";
import "./styles/global.css";

// Flag home-screen / standalone launches so the frosted iOS status-bar overlay
// (.ios-status-blur, styled in global.css) is revealed. iOS reports this via the
// non-standard `navigator.standalone`; other engines via the display-mode query.
const isStandalone =
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;
if (isStandalone) {
  document.documentElement.classList.add("pwa-standalone");
}

// Register the service-worker sandbox (built separately → dist/code.js).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./code.js").catch(() => {
      // Registration is best-effort; the app works fine without it.
    });
  });
}

// Block pinch-zoom / double-tap zoom for a native-app feel.
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
