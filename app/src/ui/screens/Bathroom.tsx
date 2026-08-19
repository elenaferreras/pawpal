import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "../components/ConfirmDialog";
import { SwipeableRow } from "../components/SwipeableRow";
import { PageTitle, CardTitle } from "../components/Typography";
import { RevealItem } from "../components/Reveal";
import { Icons } from "../lib/icons";
import { fmtDate } from "../lib/date";
import type { BathroomType } from "../types";

interface BathroomProps {
  onAdd: () => void;
  onEdit: (index: number) => void;
}

const DARK = "var(--color-pawpal-page)"; // #352B25 page background
const CREAM = "var(--color-pawpal-hero)"; // #E9E4C4 foreground
const POOP = "#A9E7A7"; // green accent

function typeLabel(type: BathroomType): string {
  return type === "pipi" ? "Pipi" : type === "popo" ? "Popo" : "Pipi & Popo";
}

function typeEmoji(type: BathroomType): string {
  return type === "pipi" ? "💧" : "💩";
}

/**
 * Bathroom screen — the single source of truth for every bathroom event.
 *
 * Dark page listing all pipi/popo logs (standalone or auto-created from a walk)
 * newest-first, with swipe-to Edit/Delete. Entries whose `source` is set were
 * created from a walk and carry a subtle "from walk" badge, but stay fully
 * editable here.
 */
export function Bathroom({ onAdd, onEdit }: BathroomProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const name = db.profile.name.trim() || "Zipi";

  const history = db.bathroom
    .map((b, index) => ({ b, index }))
    .sort(
      (a, b) =>
        new Date(b.b.created || b.b.date).getTime() - new Date(a.b.created || a.b.date).getTime(),
    );

  const del = async (index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this entry?",
      message: "This bathroom log will be permanently removed.",
      confirmLabel: "Delete Entry",
    });
    if (!ok) return;
    update((d) => {
      const created = d.bathroom[index]?.created;
      d.bathroom.splice(index, 1);
      if (created) {
        const nIdx = d.vetRecords.noteItems?.findIndex((n) => n.source === created) ?? -1;
        if (nIdx >= 0) d.vetRecords.noteItems?.splice(nIdx, 1);
      }
    });
    toast("Entry deleted");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        padding:
          "calc(16px + env(safe-area-inset-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {/* Header — title + add button */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PageTitle style={{ flex: 1, margin: "4px 0" }}>{name}&rsquo;s Bathroom</PageTitle>
        <button
          type="button"
          aria-label="Log bathroom event"
          onClick={onAdd}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            flexShrink: 0,
            border: "none",
            cursor: "pointer",
            background: "var(--color-dash-surface)",
            color: CREAM,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon icon={Icons.plusCircle} color="inherit" />
        </button>
      </div>

      {history.length === 0 ? (
        <div
          style={{
            marginTop: 24,
            background: "var(--color-dash-surface)",
            borderRadius: 24,
            padding: "32px 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>💩</div>
          <CardTitle color={CREAM} size={20} weight={400} style={{ display: "block" }}>
            No bathroom logs yet
          </CardTitle>
          <span
            style={{
              display: "block",
              marginTop: 6,
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              color: "var(--color-pawpal-muted)",
            }}
          >
            Log an event here, or toggle “Pooped” on a walk and it shows up automatically.
          </span>
        </div>
      ) : (
        <>
          <CardTitle
            color={CREAM}
            size={20}
            weight={400}
            style={{ display: "block", margin: "24px 8px 12px" }}
          >
            History
          </CardTitle>
          <div
            style={{
              background: "var(--color-dash-surface)",
              borderRadius: 24,
              overflow: "hidden",
            }}
          >
            {history.map(({ b, index }, i) => (
              <RevealItem
                key={index}
                index={i}
                style={{
                  borderTop: i === 0 ? undefined : "1px solid rgba(233,228,196,0.12)",
                }}
              >
                <SwipeableRow
                  background="var(--color-dash-surface)"
                  actions={[
                    {
                      label: "Edit",
                      color: "#5b5150",
                      icon: <Icon icon={Icons.pencilSimple} color="inherit" />,
                      onAction: () => onEdit(index),
                    },
                    {
                      label: "Delete",
                      color: "#ff3b30",
                      icon: <Icon icon={Icons.trash} color="inherit" />,
                      onAction: () => del(index),
                    },
                  ]}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        fontSize: 18,
                        background: POOP,
                        flexShrink: 0,
                      }}
                    >
                      {typeEmoji(b.type)}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontFamily: "var(--font-ui)",
                          fontSize: 15,
                          fontWeight: 500,
                          color: CREAM,
                        }}
                      >
                        {typeLabel(b.type)}
                        {b.consistency ? ` · ${b.consistency}` : ""}
                        {b.source && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "rgba(233,228,196,0.14)",
                              color: "var(--color-pawpal-muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            from walk
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-ui)",
                          fontSize: 13,
                          color: "var(--color-pawpal-muted)",
                        }}
                      >
                        {fmtDate(b.date)} {b.time}
                        {b.notes ? ` · ${b.notes}` : ""}
                      </span>
                    </span>
                    {b.photos.length > 0 && (
                      <img
                        src={b.photos[0]}
                        alt=""
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                </SwipeableRow>
              </RevealItem>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
