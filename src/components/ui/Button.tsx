import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "button-primary border disabled:border-[var(--line)] disabled:bg-[var(--line-strong)] disabled:shadow-none",
  secondary:
    "button-secondary border shadow-[0_1px_2px_rgba(23,24,30,0.03)] disabled:text-[var(--placeholder)] disabled:shadow-none",
  ghost: "button-ghost disabled:text-[var(--placeholder)]",
  danger:
    "border border-rose-700 bg-rose-600 text-white shadow-[0_5px_14px_rgba(225,29,72,0.14)] hover:bg-rose-700 disabled:border-rose-300 disabled:bg-rose-300 disabled:shadow-none"
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  icon: "h-9 w-9 justify-center p-0"
};

export function Button({ className, variant = "secondary", size = "md", children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[10px] font-medium transition duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--surface)] disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
