import { useState } from "react";
import { useDb } from "../lib/store";
import { Icons } from "../lib/icons";

interface VetAppointmentsProps {
  open: boolean;
  onClose: () => void;
  /** Opens the shared "add vet record" modal. */
  onAdd: () => void;
}

type CategoryId = "checkups" | "medications" | "vaccines" | "reminders";

interface CardRow {
  label: string;
  date: string;
}

interface CategoryView {
  id: CategoryId;
  label: string;
  color: string;
  rows: CardRow[];
}

/** "YYYY-MM-DD" → "DD-MM-YY" (matching the Figma date format). */
function fmtDDMMYY(d?: string): string {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const [y, m, day] = parts;
  return `${day}-${m}-${y.slice(2)}`;
}

/**
 * Vet Appointments screen (Figma node 12:1216).
 *
 * Full-screen overlay opened from the track menu's "vet" bubble. Shows a large
 * title, filter chips, and colour-coded cards (Checkups, Medication, Vaccines,
 * Notes) populated from the vet records. Each card's "+" opens the shared add
 * modal. Card colours reuse theme tokens.
 */
export function VetAppointments({ open, onClose, onAdd }: VetAppointmentsProps): React.ReactElement | null {
  const { db } = useDb();
  const [filter, setFilter] = useState<CategoryId | null>(null);

  if (!open) return null;

  const { checkups, medications, vaccines, reminders } = db.vetRecords;

  const categories: CategoryView[] = [
    {
      id: "checkups",
      label: "Checkups",
      color: "var(--color-pawpal-hero)",
      rows: checkups.map((c) => ({ label: c.reason, date: fmtDDMMYY(c.date) })),
    },
    {
      id: "medications",
      label: "Medication",
      color: "var(--color-track-meds)",
      rows: medications.map((m) => ({ label: m.name, date: fmtDDMMYY(m.start) })),
    },
    {
      id: "vaccines",
      label: "Vaccines",
      color: "var(--color-track-poop)",
      rows: vaccines.map((v) => ({ label: v.name, date: fmtDDMMYY(v.date) })),
    },
    {
      id: "reminders",
      label: "Notes",
      color: "var(--color-track-notes)",
      rows: reminders.map((r) => ({ label: r.title, date: fmtDDMMYY(r.date) })),
    },
  ];

  const visible = filter ? categories.filter((c) => c.id === filter) : categories;

  const CaretLeft = Icons.caretLeft;
  const Plus = Icons.plus;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vet Appointments"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "var(--color-pawpal-page)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        animation: "pawpal-overlay-fade 220ms ease both",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: "calc(24px + env(safe-area-inset-top, 0px)) 16px calc(32px + env(safe-area-inset-bottom, 20px))",
        }}
      >
        {/* Back button */}
        <button
          type="button"
          aria-label="Back"
          onClick={onClose}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: "var(--color-pawpal-hero)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <CaretLeft size={32} />
        </button>

        {/* Title */}
        <h1
          style={{
            margin: 0,
            fontSize: 56,
            fontWeight: 300,
            lineHeight: "normal",
            color: "var(--color-pawpal-hero)",
          }}
        >
          Vet Appointments
        </h1>

        {/* Filter chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {categories.map((c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(active ? null : c.id)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "16px 24px",
                  borderRadius: 40,
                  fontSize: 16,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  background: active ? "var(--color-pawpal-hero)" : "rgba(255, 255, 255, 0.14)",
                  color: active ? "var(--color-pawpal-page)" : "var(--color-pawpal-hero)",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Cards — collapsed stacked deck by default; a selected chip/card
            expands to reveal its rows. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {visible.map((c, i) => {
            const expanded = filter !== null;
            return (
              <section
                key={c.id}
                onClick={() => {
                  if (!expanded) setFilter(c.id);
                }}
                style={{
                  background: c.color,
                  borderRadius: 40,
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  marginTop: i === 0 ? 0 : -16,
                  cursor: expanded ? "default" : "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 32,
                      fontWeight: 700,
                      lineHeight: "normal",
                      color: "var(--color-pawpal-page)",
                    }}
                  >
                    {c.label}
                  </h2>
                  <button
                    type="button"
                    aria-label={`Add ${c.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd();
                    }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      border: "none",
                      background: "var(--color-pawpal-page)",
                      color: "var(--color-pawpal-hero)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: 0,
                    }}
                  >
                    <Plus size={24} />
                  </button>
                </div>

                {expanded &&
                  (c.rows.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 300, color: "var(--color-pawpal-page)", opacity: 0.5 }}>
                      No {c.label.toLowerCase()} yet
                    </p>
                  ) : (
                    c.rows.map((row, ri) => (
                      <div
                        key={ri}
                        style={{
                          display: "flex",
                          gap: 16,
                          alignItems: "flex-start",
                          fontSize: 24,
                          fontWeight: 300,
                          color: "var(--color-pawpal-page)",
                        }}
                      >
                        <span style={{ flex: "1 0 0", minWidth: 0 }}>{row.label}</span>
                        {row.date && <span style={{ whiteSpace: "nowrap" }}>{row.date}</span>}
                      </div>
                    ))
                  ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
