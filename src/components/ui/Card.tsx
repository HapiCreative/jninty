import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export default function Card({
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-cream-200 bg-white p-4 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
