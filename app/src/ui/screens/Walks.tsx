import { useState } from "react";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Header } from "../components/Header";
import { fmtDate, WEATHER_MAP } from "../lib/date";
import type { Walk } from "../types";

type Filter = "all" | "today" | "week";

interface WalksProps {
  onAdd: () => void;
  onEdit: (index: number) => void;
}

export function Walks({ onAdd, onEdit }: WalksProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");

  const todayStr = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const indexed = db.walks.map((w, index) => ({ w, index }));
  let list = [...indexed].sort(
    (a, b) => new Date(b.w.created || b.w.date).getTime() - new Date(a.w.created || a.w.date).getTime(),
  );
  if (filter === "today") list = list.filter(({ w }) => w.date === todayStr);
  if (filter === "week") list = list.filter(({ w }) => new Date(w.date) >= weekAgo);

  const avgSteps = db.walks.length
    ? Math.round(db.walks.reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0) / db.walks.length)
    : 0;

  const del = (index: number): void => {
    if (!window.confirm("Delete this walk?")) return;
    update((d) => {
      d.walks.splice(index, 1);
    });
    toast("Walk deleted");
  };

  return (
    <div className="screen">
      <Header
        title="Walks"
        subtitle={`${list.length} walk${list.length !== 1 ? "s" : ""} logged`}
        action={
          <button className="hdr-btn" onClick={onAdd} aria-label="Add walk">
            <i className="ph ph-plus" />
          </button>
        }
      />

      <div className="stat-row">
        <div className="stat-chip">
          <div className="sv">{db.walks.length}</div>
          <div className="sl">total</div>
        </div>
        <div className="stat-chip">
          <div className="sv">{avgSteps > 999 ? (avgSteps / 1000).toFixed(1) + "k" : avgSteps}</div>
          <div className="sl">avg steps</div>
        </div>
        <div className="stat-chip">
          <div className="sv">{db.walks.filter((w) => w.friends).length}</div>
          <div className="sl">with friends</div>
        </div>
      </div>

      <div className="pills">
        {(["all", "today", "week"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={"pill" + (filter === f ? " active" : "")}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "today" ? "Today" : "This week"}
          </button>
        ))}
      </div>

      <div className="card card-flush" style={{ marginTop: 12 }}>
        {list.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <i className="ph ph-paw-print" />
            </div>
            <p>No walks logged yet.<br />Tap + to record your first walk!</p>
          </div>
        ) : (
          list.map(({ w, index }) => (
            <WalkRow key={index} walk={w} onEdit={() => onEdit(index)} onDelete={() => del(index)} />
          ))
        )}
      </div>
    </div>
  );
}

function WalkRow({ walk, onEdit, onDelete }: { walk: Walk; onEdit: () => void; onDelete: () => void }): React.ReactElement {
  return (
    <div className="log-item">
      <div className="log-dot" style={{ background: "var(--green-light)", color: "var(--green)" }}>
        <i className="ph ph-paw-print" style={{ fontSize: 16 }} />
      </div>
      <div className="log-info">
        <div className="log-title">
          {fmtDate(walk.date)}
          {walk.time ? ` at ${walk.time}` : ""}
        </div>
        <div className="log-meta">
          {walk.duration ? `${walk.duration} min` : ""}
          {walk.steps ? ` · ${walk.steps} steps` : ""}
          {walk.distance ? ` · ${walk.distance}km` : ""}
          {walk.weather ? ` · ${WEATHER_MAP[walk.weather] || ""}` : ""}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
          {walk.pipi && <span className="log-badge" style={{ background: "#E3F2FD", color: "#1565C0" }}>💧 pipi</span>}
          {walk.popo && <span className="log-badge" style={{ background: "#FFF3E0", color: "#E65100" }}>💩 popo</span>}
          {walk.friends && <span className="log-badge" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>🐶 friends</span>}
        </div>
        {walk.notes && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>{walk.notes}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
        <button
          onClick={onEdit}
          style={{ border: "none", background: "var(--green-light)", color: "var(--green)", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}
        >
          Edit
        </button>
        <button className="icon-btn" onClick={onDelete}>×</button>
      </div>
    </div>
  );
}
