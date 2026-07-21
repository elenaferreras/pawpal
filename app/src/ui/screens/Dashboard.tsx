import { useMemo, useState } from "react";
import { VStack } from "@astryxdesign/core/Stack";
import { Text, Heading } from "@astryxdesign/core/Text";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Icons } from "../lib/icons";
import { WalksBarChart, type WalksBar } from "../components/WalksBarChart";
import { TrackMenu } from "../components/TrackMenu";

interface DashboardProps {
  onLogWalk: () => void;
  onLogFood: () => void;
  onLogBathroom: () => void;
  onLogVet: () => void;
}

// Muted hero text — Figma renders #8C8976 at 40% opacity.
const MUTED = { color: "var(--color-pawpal-muted)", opacity: 0.4 } as const;

// Placeholder chart shape shown when there are no walks yet (left → right).
const MOCK_FRACTIONS = [1, 0.66, 1, 0.35, 0.52];
const REAL_COLOR = "var(--color-data-yellow-3)";
const MOCK_COLOR = "var(--color-pawpal-muted)"; // #8C8976

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * New dashboard screen (Figma node 3:154).
 *
 * Preview-only for now — reachable via the temporary "Dash" tab. Intended to
 * eventually replace Home. Typography sizes/weights mirror Figma exactly:
 * title + step count are 32px / 900, "Total" is 24px / 500. Colours come from
 * PawPal theme tokens; the bar chart runs on placeholder data for now.
 */
export function Dashboard({ onLogWalk, onLogFood, onLogBathroom, onLogVet }: DashboardProps): React.ReactElement {
  const { db } = useDb();
  const toast = useToast();
  const p = db.profile;
  const Plus = Icons.plus;
  const [menuOpen, setMenuOpen] = useState(false);

  const totalSteps = db.walks.reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0);
  const stepsLabel = totalSteps > 0 ? totalSteps.toLocaleString("de-DE") : "0";

  // Chart columns: real walks fill from the RIGHT; remaining left slots (up to
  // a 5-column minimum) show muted mock placeholders. Bars scale by steps.
  const bars = useMemo<WalksBar[]>(() => {
    const todayISO = localISO(new Date());
    const walks = db.walks.filter((w) => w.date === todayISO);

    const stepsOf = (w: (typeof walks)[number]): number => parseInt(String(w.steps)) || 0;
    const maxSteps = Math.max(1, ...walks.map(stepsOf));
    const real: WalksBar[] = walks.map((w, i) => ({
      label: `${w.time || `Walk ${i + 1}`}: ${stepsOf(w)} steps`,
      fraction: stepsOf(w) / maxSteps,
      color: REAL_COLOR,
    }));

    if (real.length >= 5) return real;

    const mockCount = 5 - real.length;
    const mock: WalksBar[] = MOCK_FRACTIONS.slice(0, mockCount).map((f, i) => ({
      label: `No walk yet ${i + 1}`,
      fraction: f,
      color: MOCK_COLOR,
    }));
    return [...mock, ...real]; // mock on the left, real on the right
  }, [db.walks]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-pawpal-page)",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {/* Cream hero */}
      <div
        style={{
          background: "var(--color-pawpal-hero)",
          borderBottomLeftRadius: 40,
          borderBottomRightRadius: 40,
          paddingTop: "calc(39px + env(safe-area-inset-top, 0px))",
          paddingBottom: 32,
        }}
      >
        <VStack style={{ gap: 24 }}>
          {/* Title — 32px / 900, 1px line gap */}
          <VStack style={{ gap: 1, padding: "0 16px" }}>
            <Text as="p" style={{ fontSize: 32, fontWeight: 900, lineHeight: "normal", ...MUTED }}>
              Woof, woof
            </Text>
            <Heading
              level={1}
              style={{ fontSize: 32, fontWeight: 900, lineHeight: "normal", color: "var(--color-text-primary)" }}
            >
              {p.name || "Dieguito"}
            </Heading>
          </VStack>

          {/* Walks bar chart */}
          <div style={{ padding: "0 16px" }}>
            <WalksBarChart data={bars} />
          </div>

          {/* Counter — "Total" 24px / 500, number 32px / 900 */}
          <VStack style={{ gap: 1, padding: "0 16px" }}>
            <Text as="p" style={{ fontSize: 24, fontWeight: 500, lineHeight: "normal", ...MUTED }}>
              Total
            </Text>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Text
                as="span"
                style={{ fontSize: 32, fontWeight: 900, lineHeight: "normal", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}
              >
                {stepsLabel}
              </Text>
              <Text as="span" style={{ fontSize: 32, fontWeight: 900, lineHeight: "normal", ...MUTED }}>
                steps
              </Text>
            </div>
          </VStack>
        </VStack>
      </div>

      {/* Floating action button — 64px yellow circle, 32px black plus */}
      <button
        type="button"
        aria-label="Add"
        onClick={() => setMenuOpen(true)}
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
          width: 64,
          height: 64,
          borderRadius: 100,
          border: "none",
          background: "var(--color-pawpal-fab)",
          color: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 50,
        }}
      >
        <Plus size={32} />
      </button>

      <TrackMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onWalk={onLogWalk}
        onMeal={onLogFood}
        onDiary={() => toast("Diary coming soon \u{1F43E}")}
        onPoop={onLogBathroom}
        onVet={onLogVet}
      />
    </div>
  );
}
