import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = "", ...rest }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 placeholder:text-brown-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25 disabled:pointer-events-none disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}
