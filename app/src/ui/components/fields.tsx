import { DateInput } from "@astryxdesign/core/DateInput";
import { TimeInput } from "@astryxdesign/core/TimeInput";

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isLabelHidden?: boolean;
}

// Thin wrappers around astryx DateInput/TimeInput that accept plain string
// values. Astryx uses branded ISODateString / ISOTimeString types; the app
// stores plain "YYYY-MM-DD" / "HH:MM" strings, so the cast is centralised here.
//
// astryx sizes the field to the input's intrinsic width, so two placed
// side-by-side in a flex row (e.g. the walk form's Date + Time) overflow a
// narrow phone. Fill the container (width="100%") and wrap in a shrinkable flex
// box so they share the row and never exceed it.
const shrinkWrap: React.CSSProperties = { flex: "1 1 0", minWidth: 0 };

export function DateField({ label, value, onChange, isLabelHidden }: FieldProps): React.ReactElement {
  return (
    <div style={shrinkWrap}>
      <DateInput
        label={label}
        isLabelHidden={isLabelHidden}
        width="100%"
        value={(value || undefined) as never}
        onChange={(v) => onChange((v as string | undefined) ?? "")}
      />
    </div>
  );
}

export function TimeField({ label, value, onChange, isLabelHidden }: FieldProps): React.ReactElement {
  return (
    <div style={shrinkWrap}>
      <TimeInput
        label={label}
        isLabelHidden={isLabelHidden}
        width="100%"
        value={(value || undefined) as never}
        onChange={(v) => onChange((v as string | undefined) ?? "")}
      />
    </div>
  );
}
