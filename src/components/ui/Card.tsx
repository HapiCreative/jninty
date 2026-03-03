import { forwardRef, type HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = "", children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`rounded-xl border border-border-default bg-surface-elevated p-4 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
