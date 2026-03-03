import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", ...rest }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25 disabled:pointer-events-none disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}
