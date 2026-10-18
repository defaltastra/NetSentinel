import type { ReactNode } from "react";
import Icon from "./Icon";

export function Search({
  placeholder = "Search",
  value,
  onChange,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (val: string) => void;
}) {
  return (
    <label className="search">
      <Icon name="search" size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}

export function Select({
  children,
  label,
  value,
  onChange,
}: {
  children: ReactNode;
  label: string;
  value?: string;
  onChange?: (val: string) => void;
}) {
  return (
    <label className="select-wrap">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

export function Toggle({
  on = false,
  onChange,
}: {
  on?: boolean;
  onChange?: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label="Toggle setting"
      className={`toggle ${on ? "on" : ""}`}
      onClick={() => onChange?.(!on)}
    >
      <span />
    </button>
  );
}
