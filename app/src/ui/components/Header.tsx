import type { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps): ReactNode {
  return (
    <div className="hdr">
      <div>
        <div className="hdr-title">{title}</div>
        {subtitle && <div className="hdr-sub">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
