import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}
