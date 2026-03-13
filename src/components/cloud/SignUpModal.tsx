import { useState, useRef, type FormEvent } from "react";
import { register } from "../../lib/apiClient";
import {
  stripeMonthlyPriceId,
  stripeAnnualPriceId,
  monthlyPrice,
  annualPrice,
} from "../../config/cloud";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useModalA11y } from "../../hooks/useModalA11y";

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export default function SignUpModal({
  isOpen,
  onClose,
  onSwitchToLogin,
}: SignUpModalProps) {
  const [plan, setPlan] = useState<"annual" | "monthly">("monthly");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useModalA11y(onClose);

  if (!isOpen) return null;

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors["email"] = "Please enter a valid email address.";
    }
    if (password.length < 8) {
      errors["password"] = "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      errors["confirmPassword"] = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    const priceId =
      plan === "annual" ? stripeAnnualPriceId : stripeMonthlyPriceId;
    if (!priceId) {
      setError("Pricing not configured. Please contact support.");
      return;
    }

    setLoading(true);
    try {
      const result = await register(email, password, priceId);
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-modal-title"
        className="w-full max-w-md rounded-2xl border border-cream-200 bg-white p-8 shadow-lg"
      >
        {/* Logo */}
        <div className="flex items-center justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-900 font-display text-sm font-extrabold text-cream-50">
            J
          </div>
          <span className="ml-2 font-display text-xl font-bold text-green-800">
            Jninty
          </span>
        </div>

        <h2
          id="signup-modal-title"
          className="mt-6 mb-1 text-center font-display text-2xl font-bold text-green-800"
        >
          Start Jninty Cloud
        </h2>
        <p className="mb-6 text-center font-sans text-sm text-soil-400">
          Sync your garden across every device.
        </p>

        {/* Plan toggle */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-lg border border-brown-300 bg-cream-200 p-1">
            <button
              type="button"
              onClick={() => setPlan("monthly")}
              className={`rounded-md px-4 py-1.5 font-sans text-sm font-semibold transition-all ${
                plan === "monthly"
                  ? "bg-white text-soil-900 shadow-sm"
                  : "text-soil-600 hover:text-soil-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setPlan("annual")}
              className={`rounded-md px-4 py-1.5 font-sans text-sm transition-colors ${
                plan === "annual"
                  ? "bg-white font-semibold text-soil-900 shadow-sm"
                  : "font-medium text-soil-600 hover:text-soil-900"
              }`}
            >
              Annual
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="mb-4">
            <label
              htmlFor="signup-email"
              className="mb-1 block text-left font-sans text-sm font-medium text-soil-700"
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next["email"];
                  return next;
                });
              }}
              autoComplete="email"
              className="w-full rounded-lg border border-brown-300 bg-white px-3 py-2 font-sans text-sm text-soil-900 placeholder:text-soil-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
            />
            {fieldErrors["email"] && (
              <p className="mt-1 text-xs text-terracotta-600">{fieldErrors["email"]}</p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="signup-password"
              className="mb-1 block text-left font-sans text-sm font-medium text-soil-700"
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next["password"];
                  return next;
                });
              }}
              autoComplete="new-password"
              className="w-full rounded-lg border border-brown-300 bg-white px-3 py-2 font-sans text-sm text-soil-900 placeholder:text-soil-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
            />
            {fieldErrors["password"] && (
              <p className="mt-1 text-xs text-terracotta-600">{fieldErrors["password"]}</p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="signup-confirm-password"
              className="mb-1 block text-left font-sans text-sm font-medium text-soil-700"
            >
              Confirm Password
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next["confirmPassword"];
                  return next;
                });
              }}
              autoComplete="new-password"
              className="w-full rounded-lg border border-brown-300 bg-white px-3 py-2 font-sans text-sm text-soil-900 placeholder:text-soil-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
            />
            {fieldErrors["confirmPassword"] && (
              <p className="mt-1 text-xs text-terracotta-600">{fieldErrors["confirmPassword"]}</p>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-terracotta-400/10 p-3 text-sm text-terracotta-600" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-terracotta-500 px-6 py-3 text-center font-sans text-base font-semibold text-white shadow-lg transition-all hover:bg-terracotta-600 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Continue to Payment \u2192"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-soil-400">
          &#128274; You&apos;ll be redirected to Stripe for secure payment.
        </p>
        <p className="mt-4 block text-center text-sm text-soil-600">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-green-700 hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
