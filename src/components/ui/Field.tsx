import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block space-y-2">
      <span className="field-label flex items-center justify-between gap-3 text-[13px] font-semibold">
        {label}
        {hint ? <span className="field-hint text-xs font-normal">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "field-control h-10 w-full rounded-[10px] border px-3 text-sm outline-none transition focus:ring-[3px] disabled:bg-[var(--surface-muted)] disabled:text-[var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "field-control min-h-24 w-full resize-y rounded-[10px] border px-3 py-2 text-sm leading-6 outline-none transition focus:ring-[3px] disabled:bg-[var(--surface-muted)] disabled:text-[var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "field-control h-10 w-full rounded-[10px] border px-3 text-sm outline-none transition focus:ring-[3px] disabled:bg-[var(--surface-muted)] disabled:text-[var(--muted)]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
