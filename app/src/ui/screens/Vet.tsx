import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Header } from "../components/Header";
import { fmtDate } from "../lib/date";
import type { Priority } from "../types";

interface VetProps {
  onAdd: () => void;
}

const PRIORITY_COLOUR: Record<Priority, string> = {
  High: "#FF3B30",
  Medium: "var(--amber)",
  Low: "var(--green)",
};

type Collection = "checkups" | "vaccines" | "reminders" | "medications";

export function Vet({ onAdd }: VetProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const { checkups, vaccines, reminders, medications } = db.vetRecords;

  const del = (collection: Collection, index: number): void => {
    if (!window.confirm("Delete this record?")) return;
    update((d) => {
      d.vetRecords[collection].splice(index, 1);
    });
    toast("Deleted");
  };

  const sortedReminders = reminders
    .map((r, index) => ({ r, index }))
    .sort((a, b) => new Date(a.r.date).getTime() - new Date(b.r.date).getTime());
  const sortedVaccines = vaccines
    .map((v, index) => ({ v, index }))
    .sort((a, b) => new Date(b.v.date).getTime() - new Date(a.v.date).getTime());
  const sortedCheckups = checkups
    .map((c, index) => ({ c, index }))
    .sort((a, b) => new Date(b.c.date).getTime() - new Date(a.c.date).getTime());

  return (
    <div className="screen">
      <Header
        title="Vet & Health"
        subtitle="Checkups, vaccines & meds"
        action={
          <button className="hdr-btn" onClick={onAdd} aria-label="Add record">
            <i className="ph ph-plus" />
          </button>
        }
      />

      <div className="section-label">Reminders</div>
      <div className="card card-flush">
        {sortedReminders.length === 0 ? (
          <Empty icon="ph-bell" text="No upcoming reminders." />
        ) : (
          sortedReminders.map(({ r, index }) => (
            <div className="reminder-item" key={index}>
              <div className="reminder-dot" style={{ background: PRIORITY_COLOUR[r.priority] }} />
              <div className="reminder-info">
                <div className="reminder-title">{r.title}</div>
                <div className="reminder-date">
                  {r.date ? fmtDate(r.date) : "No date set"} · {r.priority} priority
                </div>
              </div>
              <button className="icon-btn" onClick={() => del("reminders", index)}>×</button>
            </div>
          ))
        )}
      </div>

      <div className="section-label">Medications</div>
      <div className="card card-flush">
        {medications.length === 0 ? (
          <Empty icon="ph-pill" text="No medications logged." />
        ) : (
          medications.map((m, index) => {
            const daysLeft = m.end
              ? Math.ceil((new Date(m.end + "T12:00:00").getTime() - Date.now()) / 86400000)
              : null;
            const progress =
              m.days && m.start
                ? Math.min(
                    100,
                    Math.round(
                      ((Date.now() - new Date(m.start + "T12:00:00").getTime()) / 86400000 / m.days) * 100,
                    ),
                  )
                : 0;
            const urgent = daysLeft !== null && daysLeft <= 2;
            return (
              <div className="med-item" key={index} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="med-icon">
                    <i className="ph ph-pill" style={{ fontSize: 16 }} />
                  </div>
                  <div className="med-info">
                    <div className="med-name">{m.name}</div>
                    <div className="med-detail">
                      {m.dose} {m.freq ? `· ${m.freq}` : ""}
                    </div>
                    {m.notes && <div className="med-detail">{m.notes}</div>}
                  </div>
                  <button className="icon-btn" style={{ flexShrink: 0 }} onClick={() => del("medications", index)}>×</button>
                </div>
                {m.days > 0 ? (
                  <div style={{ paddingBottom: 4 }}>
                    <div className="row-between" style={{ marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)" }}>
                        {m.start ? fmtDate(m.start) : ""} → {m.end ? fmtDate(m.end) : ""}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: urgent ? "#FF3B30" : "var(--text2)" }}>
                        {daysLeft !== null ? (daysLeft <= 0 ? "Completed" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`) : "Ongoing"}
                      </span>
                    </div>
                    <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: urgent ? "#FF3B30" : "var(--amber)", borderRadius: 3 }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text2)", paddingBottom: 4 }}>Ongoing — no end date</div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="section-label">Vaccinations</div>
      <div className="card card-flush">
        {sortedVaccines.length === 0 ? (
          <Empty icon="ph-syringe" text="No vaccinations recorded." />
        ) : (
          sortedVaccines.map(({ v, index }) => (
            <div className="log-item" key={index}>
              <div className="log-dot" style={{ background: "var(--brown-light)", color: "var(--brown)" }}>
                <i className="ph ph-syringe" style={{ fontSize: 16 }} />
              </div>
              <div className="log-info">
                <div className="log-title">{v.name}</div>
                <div className="log-meta">
                  {v.date ? `Given ${fmtDate(v.date)}` : ""}
                  {v.nextDue ? ` · Next: ${fmtDate(v.nextDue)}` : ""}
                </div>
              </div>
              <button className="icon-btn" onClick={() => del("vaccines", index)}>×</button>
            </div>
          ))
        )}
      </div>

      <div className="section-label">Checkups</div>
      <div className="card card-flush">
        {sortedCheckups.length === 0 ? (
          <Empty icon="ph-clipboard-text" text="No checkups recorded." />
        ) : (
          sortedCheckups.map(({ c, index }) => (
            <div className="log-item" key={index}>
              <div className="log-dot" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
                <i className="ph ph-clipboard-text" style={{ fontSize: 16 }} />
              </div>
              <div className="log-info">
                <div className="log-title">{c.reason}</div>
                <div className="log-meta">
                  {c.date ? fmtDate(c.date) : ""}
                  {c.clinic ? ` · ${c.clinic}` : ""}
                </div>
                {c.notes && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 3 }}>{c.notes}</div>}
                {c.hasFile && <div style={{ fontSize: 12, color: "var(--green)", marginTop: 3 }}>📎 {c.fileName}</div>}
              </div>
              <button className="icon-btn" onClick={() => del("checkups", index)}>×</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }): React.ReactElement {
  return (
    <div className="empty" style={{ padding: 24 }}>
      <div className="empty-icon">
        <i className={"ph " + icon} />
      </div>
      <p>{text}</p>
    </div>
  );
}
