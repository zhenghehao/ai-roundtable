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
    "bg-gradient-to-br from-[#7c5cff] to-[#5b7cfa] text-white shadow-[0_10px_24px_rgba(91,124,250,0.22)] hover:brightness-105 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none",
  secondary:
    "border border-slate-200/80 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400 disabled:shadow-none",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950 disabled:text-slate-400",
  danger:
    "bg-rose-600 text-white shadow-[0_10px_24px_rgba(225,29,72,0.16)] hover:bg-rose-700 disabled:bg-rose-300 disabled:shadow-none"
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
        "inline-flex shrink-0 items-center justify-center rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed",
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
