// Shared portal target for full-screen overlays (sheets, editors).
//
// Overlays must NOT be portaled into <body>, because the scroll-lock
// (`useScrollLock`) makes <body> `position: fixed` while a sheet is open. On
// iOS a `position: fixed` scrim that descends from a fixed, scroll-locked body
// takes its containing block from that body — the *small* viewport, which
// excludes the bottom home-indicator safe area — so the scrim stops ~34px short
// of the physical bottom and the brown page background shows through as a gap.
//
// Mounting the overlay root as a direct child of <html> (a sibling of <body>)
// keeps it out of the scroll-locked body's subtree, so a fixed `inset: 0` scrim
// resolves against the full-screen initial containing block, edge to edge.
let root: HTMLElement | null = null;

export function getOverlayRoot(): HTMLElement {
  if (root && root.isConnected) return root;
  root = document.getElementById("pp-overlay-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "pp-overlay-root";
    document.documentElement.appendChild(root);
  }
  return root;
}
