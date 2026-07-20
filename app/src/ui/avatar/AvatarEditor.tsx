import { useState } from "react";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import type { Avatar } from "../types";
import {
  PALETTE_LIST,
  HEAD_LIST,
  BODY_LIST,
  EYES_LIST,
  NOSE_LIST,
  HEAD_LABELS,
  BODY_LABELS,
  EYES_LABELS,
  NOSE_LABELS,
} from "./assets.generated";
import { headThumb, bodyThumb, eyeThumb, noseThumb } from "./build";
import { DogAvatar } from "./DogAvatar";

type Tab = "colour" | "head" | "eyes" | "nose" | "body";

const TABS: Tab[] = ["colour", "head", "eyes", "nose", "body"];
const TAB_LABELS: Record<Tab, string> = {
  colour: "Colour",
  head: "Head",
  eyes: "Eyes",
  nose: "Nose",
  body: "Body",
};

interface Palette {
  key: string;
  hex: string;
  label: string;
  border?: boolean;
}

const palettes = PALETTE_LIST as Palette[];
const headLabels = HEAD_LABELS as Record<string, string>;
const bodyLabels = BODY_LABELS as Record<string, string>;
const eyesLabels = EYES_LABELS as Record<string, string>;
const noseLabels = NOSE_LABELS as Record<string, string>;

interface AvatarEditorProps {
  value: Avatar;
  onChange: (next: Avatar) => void;
  previewSize?: number;
}

export function AvatarEditor({
  value,
  onChange,
  previewSize = 150,
}: AvatarEditorProps): React.ReactElement {
  const [tab, setTab] = useState<Tab>("colour");
  const set = (patch: Partial<Avatar>): void => onChange({ ...value, ...patch });

  return (
    <div>
      <div className="av-preview">
        <DogAvatar avatar={value} size={previewSize} />
      </div>

      <div style={{ margin: "12px 0" }}>
        <SegmentedControl value={tab} onChange={(v) => setTab(v as Tab)} label="Avatar part" layout="fill" size="sm">
          {TABS.map((t) => (
            <SegmentedControlItem key={t} value={t} label={TAB_LABELS[t]} />
          ))}
        </SegmentedControl>
      </div>

      {tab === "colour" && (
        <div className="av-grid av-grid-colour">
          {palettes.map((p) => (
            <button
              key={p.key}
              type="button"
              className={"av-thumb" + (value.colour === p.key ? " selected" : "")}
              onClick={() => set({ colour: p.key })}
            >
              <span
                className="av-colour-swatch"
                style={{
                  background: p.hex,
                  border: p.border ? "1px solid #ddd" : undefined,
                }}
              />
            </button>
          ))}
        </div>
      )}

      {tab === "head" && (
        <PartGrid
          items={HEAD_LIST}
          labels={headLabels}
          current={value.head}
          thumb={(name) => headThumb(name, value.colour)}
          onPick={(name) => set({ head: name })}
        />
      )}
      {tab === "body" && (
        <PartGrid
          items={BODY_LIST}
          labels={bodyLabels}
          current={value.body}
          thumb={(name) => bodyThumb(name, value.colour)}
          onPick={(name) => set({ body: name })}
        />
      )}
      {tab === "eyes" && (
        <PartGrid
          items={EYES_LIST}
          labels={eyesLabels}
          current={value.eyes}
          thumb={(name) => eyeThumb(name)}
          onPick={(name) => set({ eyes: name })}
        />
      )}
      {tab === "nose" && (
        <PartGrid
          items={NOSE_LIST}
          labels={noseLabels}
          current={value.nose}
          thumb={(name) => noseThumb(name)}
          onPick={(name) => set({ nose: name })}
        />
      )}
    </div>
  );
}

interface PartGridProps {
  items: readonly string[];
  labels: Record<string, string>;
  current: string;
  thumb: (name: string) => string;
  onPick: (name: string) => void;
}

function PartGrid({ items, labels, current, thumb, onPick }: PartGridProps): React.ReactElement {
  return (
    <div className="av-grid">
      {items.map((name) => (
        <button
          key={name}
          type="button"
          className={"av-thumb av-thumb-part" + (current === name ? " selected" : "")}
          onClick={() => onPick(name)}
        >
          <img src={thumb(name)} alt={labels[name] || name} />
          <span className="av-thumb-label">{labels[name] || name}</span>
        </button>
      ))}
    </div>
  );
}
