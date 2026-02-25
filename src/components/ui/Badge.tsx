import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-cream-200 text-soil-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-brown-100 text-brown-800",
  danger: "bg-terracotta-400/20 text-terracotta-600",
};

export default function Badge({
  variant = "default",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
