import type { ReactNode } from "react";
import Icon from "./Icon";
import type { IconName } from "../../types";

export interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export default function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  disabled = false,
  className = "",
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`button ${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
