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
export function DateField({ label, value, onChange, isLabelHidden }: FieldProps): React.ReactElement {
  return (
    <DateInput
      label={label}
      isLabelHidden={isLabelHidden}
      value={(value || undefined) as never}
      onChange={(v) => onChange((v as string | undefined) ?? "")}
    />
  );
}

export function TimeField({ label, value, onChange, isLabelHidden }: FieldProps): React.ReactElement {
  return (
    <TimeInput
      label={label}
      isLabelHidden={isLabelHidden}
      value={(value || undefined) as never}
      onChange={(v) => onChange((v as string | undefined) ?? "")}
    />
  );
}
