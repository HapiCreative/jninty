import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "default";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-surface-muted text-text-primary border border-border-strong hover:bg-surface-inset active:bg-surface-inset",
  ghost:
    "bg-transparent text-text-heading hover:bg-green-50 active:bg-green-100",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "px-4 py-2 text-sm",
  sm: "px-2.5 py-1 text-xs",
};

export default function Button({
  variant = "primary",
  size = "default",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-sans font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
