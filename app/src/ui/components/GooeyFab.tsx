import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface GooeyFabProps {
  open: boolean;
  onClose: () => void;
  onWalk: () => void;
  onMeal: () => void;
  onDiary: () => void;
  onPoop: () => void;
  onVet: () => void;
}

interface Item {
  key: string;
  label: string;
  color: string;
  /** Resting position within the 300×248 cluster box (Figma node 10:373). */
  bx: number;
  by: number;
  onSelect: () => void;
}

interface Pt {
  x: number;
  y: number;
}

/** Glowy bubble diameter (px) — matches the previous TrackMenu. */
const BUBBLE = 116;
/** Solid goo-blob diameter — larger than the glow bubble so neighbouring
 * blobs overlap underneath and form the melty necks. */
const GOO_D = 132;
/** Cluster box the resting positions are measured in (bottom-right anchored). */
const BOX_W = 300;
const BOX_H = 248;
/** Cluster box offset from the bottom-right corner (matches TrackMenu). */
const BOX_BOTTOM = 72;
/** Pointer travel (px) beyond which a press is treated as a drag, not a tap. */
const DRAG_THRESHOLD = 6;
/** Fallback FAB centre offsets from the bottom-right corner (matches .nav-fab-grid). */
const FAB_RIGHT = 42;
const FAB_BOTTOM = 44;

/**
 * Gooey quick-add menu (prototype).
 *
 * A dependency-free "liquid" FAB: five option bubbles melt out of the tab-bar
 * launcher using an SVG gaussian-blur + contrast threshold filter (the classic
 * goo trick — no external library). Each bubble can be **dragged** anywhere on
 * screen (pointer events) as well as tapped. A short press fires the action; a
 * press that travels past {@link DRAG_THRESHOLD} is a drag and leaves the
 * bubble where you drop it, stretching a gooey neck back toward its neighbours.
 *
 * Drop-in replacement for {@link TrackMenu} — same props.
 */
export function GooeyFab({
  open,
  onClose,
  onWalk,
  onMeal,
  onDiary,
  onPoop,
  onVet,
}: GooeyFabProps): React.ReactElement | null {
  const items: Item[] = [
    { key: "walk", label: "walks", color: "#8592E0", bx: 40, by: 0, onSelect: onWalk }, // blue
    { key: "meal", label: "meals", color: "#E96A41", bx: 150, by: 14, onSelect: onMeal }, // red
    { key: "vet", label: "health", color: "#EDD4FD", bx: 8, by: 88, onSelect: onVet }, // purple
    { key: "poop", label: "poop", color: "#EDD4FD", bx: 82, by: 136, onSelect: onPoop }, // purple
    { key: "diary", label: "diary", color: "#FFFF83", bx: 162, by: 104, onSelect: onDiary }, // yellow
  ];

  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<Pt>({ x: 0, y: 0 });
  const [pos, setPos] = useState<Record<string, Pt>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);

  const drag = useRef<{
    key: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute the FAB anchor + each bubble's resting position when opening.
  useLayoutEffect(() => {
    if (!open) return;
    const fab = document.querySelector<HTMLElement>(".nav-fab-grid, .nav-fab");
    const a: Pt = fab
      ? (() => {
          const r = fab.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()
      : { x: window.innerWidth - FAB_RIGHT, y: window.innerHeight - FAB_BOTTOM };

    // Rest positions: the previous TrackMenu cluster, anchored bottom-right.
    const safe =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom")) || 0;
    const boxLeft = window.innerWidth - BOX_W;
    const boxTop = window.innerHeight - (BOX_BOTTOM + safe) - BOX_H;
    const next: Record<string, Pt> = {};
    items.forEach((it) => {
      next[it.key] = { x: boxLeft + it.bx + BUBBLE / 2, y: boxTop + it.by + BUBBLE / 2 };
    });
    setAnchor(a);
    // Start every bubble collapsed on the FAB, then release to the cluster so
    // they appear to ooze outward on the next frame.
    setPos(Object.fromEntries(items.map((it) => [it.key, { ...a }])));
    setVisible(false);
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setPos(next);
        setVisible(true);
      }),
    );
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mount/unmount lifecycle so the collapse animation can play on close.
  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (open) {
      setRender(true);
      return;
    }
    if (!render) return;
    // Collapse bubbles back into the FAB, then unmount.
    setVisible(false);
    setPos((p) => Object.fromEntries(Object.keys(p).map((k) => [k, { ...anchor }])));
    closeTimer.current = setTimeout(() => setRender(false), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!render) return null;

  const onPointerDown = (key: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const cur = pos[key] ?? anchor;
    drag.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      originX: cur.x,
      originY: cur.y,
      moved: false,
    };
    setDragKey(key);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) d.moved = true;
    if (!d.moved) return;
    setPos((p) => ({ ...p, [d.key]: { x: d.originX + dx, y: d.originY + dy } }));
  };

  const endDrag = (item: Item) => (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragKey(null);
    if (!d) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!d.moved) {
      // Treated as a tap → fire the action and close.
      onClose();
      item.onSelect();
    }
    // Dragged → leave the bubble where it was dropped.
  };

  const spring = "transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)";
  const tf = (p: Pt): string => `translate3d(${p.x}px, ${p.y}px, 0)`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick add"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.28)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.24s ease",
        touchAction: "none",
      }}
    >
      {/* Goo filter definition (hidden). */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <filter id="pawpal-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -6"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      {/* Soft yellow glow behind the launcher + every option bubble. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 260,
            height: 260,
            marginLeft: -130,
            marginTop: -130,
            borderRadius: "50%",
            transform: tf(anchor),
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-pawpal-fab) 72%, transparent) 0%, transparent 62%)",
          }}
        />
        {items.map((it) => {
          const p = pos[it.key] ?? anchor;
          return (
            <span
              key={it.key}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 220,
                height: 220,
                marginLeft: -110,
                marginTop: -110,
                borderRadius: "50%",
                transform: tf(p),
                willChange: "transform",
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--color-pawpal-fab) 72%, transparent) 0%, transparent 62%)",
                transition: dragKey === it.key ? "none" : spring,
              }}
            />
          );
        })}
      </div>

      {/* Filtered goo layer: solid coloured blobs only (no text — the filter
          would blur it). Sits behind the glow bubbles and supplies the melt. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          filter: "url(#pawpal-goo)",
          WebkitFilter: "url(#pawpal-goo)",
          opacity: 1,
        }}
      >
        {/* FAB source blob the bubbles pull away from. */}
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: GOO_D,
            height: GOO_D,
            marginLeft: -GOO_D / 2,
            marginTop: -GOO_D / 2,
            borderRadius: "50%",
            transform: tf(anchor),
            background: "var(--color-pawpal-fab)",
            mixBlendMode: "multiply",
          }}
        />
        {items.map((it) => {
          const p = pos[it.key] ?? anchor;
          return (
            <span
              key={it.key}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: GOO_D,
                height: GOO_D,
                marginLeft: -GOO_D / 2,
                marginTop: -GOO_D / 2,
                borderRadius: "50%",
                transform: tf(p),
                willChange: "transform",
                background: it.color,
                mixBlendMode: "multiply",
                transition: dragKey === it.key ? "none" : spring,
              }}
            />
          );
        })}
      </div>

      {/* Interactive layer: the previous glow bubbles + labels, drag/tap targets. */}
      {items.map((it) => {
        const p = pos[it.key] ?? anchor;
        return (
          <button
            key={it.key}
            type="button"
            aria-label={it.label}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown(it.key)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag(it)}
            onPointerCancel={endDrag(it)}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: BUBBLE,
              height: BUBBLE,
              marginLeft: -BUBBLE / 2,
              marginTop: -BUBBLE / 2,
              borderRadius: "50%",
              border: "none",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 26,
              cursor: "grab",
              touchAction: "none",
              transform: tf(p),
              willChange: "transform",
              background: `radial-gradient(circle at 50% 45%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.32) 38%, transparent 70%)`,
              opacity: visible ? 1 : 0,
              transition: dragKey === it.key ? "opacity 0.2s ease" : `opacity 0.2s ease, ${spring}`,
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
