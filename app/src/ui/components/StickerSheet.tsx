import pupUrl from "../assets/pup.png";

// Onboarding sticker sheet — matches Figma node 22:5439 ("Find your pup").
// A green die-cut sheet with a 2×2 grid of the same placeholder doodle.
// The illustration is a PLACEHOLDER (all four are identical) until real art
// lands. Selecting a sticker "peels" it off the sheet (see .sticker-* in
// global.css).

const SLOTS = ["s1", "s2", "s3", "s4"];

interface StickerSheetProps {
  value: string | null;
  onChange: (id: string) => void;
}

export function StickerSheet({ value, onChange }: StickerSheetProps): React.ReactElement {
  return (
    <div className="sticker-sheet" role="radiogroup" aria-label="Choose a sticker">
      <div className="sticker-grid">
        {SLOTS.map((id) => {
          const peeled = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={peeled}
              aria-label="Pup sticker"
              className={"sticker" + (peeled ? " peeled" : "")}
              onClick={() => onChange(id)}
            >
              {/* Faint mark left on the sheet once the sticker is peeled. */}
              <img src={pupUrl} alt="" aria-hidden className="sticker-ghost" />
              <img src={pupUrl} alt="" className="sticker-face" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
