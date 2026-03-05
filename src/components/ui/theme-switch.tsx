import { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./theme-switch.css";

interface ThemeSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  size?: number;
  ariaLabel?: string;
}

export function ThemeSwitch({
  checked,
  onCheckedChange,
  className,
  size = 12,
  ariaLabel = "Toggle theme",
}: ThemeSwitchProps) {
  const style = { "--toggle-size": `${size}px` } as CSSProperties;

  return (
    <label className={cn("theme-switch", className)} style={style}>
      <input
        type="checkbox"
        className="theme-switch__checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <div className="theme-switch__container">
        <svg viewBox="0 0 144 55" fill="none" className="theme-switch__stars-container" aria-hidden="true">
          <path
            fill="currentColor"
            d="M45 6l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6zm26 10l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5 1.5-4zm24 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"
          />
        </svg>
        <div className="theme-switch__clouds" />
        <div className="theme-switch__circle-container">
          <div className="theme-switch__sun-moon-container">
            <div className="theme-switch__moon">
              <div className="theme-switch__spot" />
              <div className="theme-switch__spot" />
              <div className="theme-switch__spot" />
            </div>
          </div>
        </div>
      </div>
    </label>
  );
}

