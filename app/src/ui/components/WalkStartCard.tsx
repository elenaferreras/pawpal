import { useMemo } from "react";
import { useDb } from "../lib/store";
import { useLiveWalk } from "./LiveWalk";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";

const DARK = "var(--color-pawpal-page)"; // #352B25

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * Walk "Start" dashboard card (Figma node 34:1418).
 *
 * Blue card showing today's date and today's logged step total, with a Start
 * button that launches the Live Walk.
 */
export function WalkStartCard(): React.ReactElement {
  const { db } = useDb();
  const { active, start } = useLiveWalk();
  const todayISO = localISO(new Date());

  const steps = useMemo(
    () =>
      db.walks
        .filter((w) => w.date === todayISO)
        .reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0),
    [db.walks, todayISO],
  );

  const today = new Date();
  const dateLabel = `${ordinal(today.getDate())} ${today.toLocaleString(undefined, { month: "short" })}, ${today.getFullYear()}`;

  return (
    <div
      style={{
        background: "var(--color-pill-steps)",
        borderRadius: 32,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        color: DARK,
        minHeight: 160,
      }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 14, opacity: 0.75 }}>
        {dateLabel}
      </span>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: "auto" }}>
        <span style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 30, lineHeight: 1 }}>
          {steps.toLocaleString("de-DE")}
        </span>
        <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 15, opacity: 0.75 }}>
          steps
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!active) start();
        }}
        aria-label={active ? "Walk in progress" : "Start a walk"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "12px 16px",
          borderRadius: 100,
          border: "none",
          cursor: active ? "default" : "pointer",
          background: DARK,
          color: "var(--color-pill-steps)",
          fontFamily: "var(--font-ui)",
          fontWeight: 700,
          fontSize: 15,
          opacity: active ? 0.7 : 1,
        }}
      >
        {active ? "In progress" : "Start"}
        {!active && <Icon icon={Icons.play} color="inherit" />}
      </button>
    </div>
  );
}
