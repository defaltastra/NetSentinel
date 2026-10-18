import Card from "./Card";
import Icon from "./Icon";
import type { IconName } from "../../types";

export interface StatCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: IconName;
  tone?: string;
}

export default function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "",
}: StatCardProps) {
  return (
    <Card className={`stat-card ${tone}`}>
      <div className="stat-head">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon name={icon} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <small>{detail}</small>
    </Card>
  );
}
