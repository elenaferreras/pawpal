import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * PawPal shared Button.
 *
 * A single custom-styled button used everywhere, replacing both the old
 * `.obw-btn` markup and the design-system `@astryxdesign/core/Button`. Styling
 * is defined once in global.css (`.btn` + variant classes) and driven by the
 * `--btn-*` custom properties so it's easy to retune.
 *
 * Props mirror the design-system Button (label / variant / icon / size /
 * isDisabled / onClick / style / className) so call sites migrate with just an
 * import swap. Variants and the pill shape come from the Figma spec
 * (node 108:992): primary = filled accent, secondary = outlined, ghost = text
 * only, destructive = filled danger.
 *
 * Theme-aware: on dark surfaces the outlined/ghost foreground is the brand
 * accent; inside light surfaces (e.g. the `.btn-surface-light` wrapper the
 * Modal applies) it flips to a dark, legible foreground.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "md" | "sm";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> {
  /** Text label. Prefer this; `children` is also supported for rich content. */
  label?: string;
  children?: ReactNode;
  /** Visual style. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** `md` (default) or the more compact `sm`. */
  size?: ButtonSize;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Stretch to fill the available width. */
  fullWidth?: boolean;
  /** Alias for the native `disabled`, matching the design-system API. */
  isDisabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function Button({
  label,
  children,
  variant = "primary",
  size = "md",
  icon,
  fullWidth = false,
  isDisabled = false,
  disabled = false,
  type = "button",
  className,
  ...rest
}: ButtonProps): React.ReactElement {
  const classes = [
    "btn",
    `btn--${variant}`,
    size === "sm" && "btn--sm",
    fullWidth && "btn--full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} disabled={disabled || isDisabled} {...rest}>
      {icon != null && <span className="btn-icon">{icon}</span>}
      {label ?? children}
    </button>
  );
}
