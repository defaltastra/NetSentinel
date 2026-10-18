import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  tone?: "critical" | "high" | "medium" | "low" | "success" | "neutral" | "cyan";
  dot?: boolean;
}

export default function Badge({ children, tone = "neutral", dot = true }: BadgeProps) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
