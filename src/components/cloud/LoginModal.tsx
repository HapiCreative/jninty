import { useState, useRef, type FormEvent } from "react";
import { useAuth } from "../../store/authStore";
import { login, PaymentRequiredError } from "../../lib/apiClient";
import { startCloudSync } from "../../lib/cloudSync";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useModalA11y } from "../../hooks/useModalA11y";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignUp: () => void;
}

export default function LoginModal({
  isOpen,
  onClose,
  onSwitchToSignUp,
}: LoginModalProps) {
  const { dispatch } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useModalA11y(onClose);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const result = await login(email, password);
      dispatch({ type: "LOGIN", payload: { user: result.user, token: result.token } });
      startCloudSync(result.user.id, result.token);
      onClose();
    } catch (err) {
      if (err instanceof PaymentRequiredError) {
        window.location.href = err.checkoutUrl;
        return;
      }
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
    } finally {
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
        aria-labelledby="login-modal-title"
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
          id="login-modal-title"
          className="mt-6 mb-1 text-center font-display text-2xl font-bold text-green-800"
        >
          Sign in to Jninty Cloud
        </h2>
        <p className="mb-6 text-center font-sans text-sm text-soil-400">
          Welcome back.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="mb-4">
            <label
              htmlFor="login-email"
              className="mb-1 block text-left font-sans text-sm font-medium text-soil-700"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border border-brown-300 bg-white px-3 py-2 font-sans text-sm text-soil-900 placeholder:text-soil-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="login-password"
              className="mb-1 block text-left font-sans text-sm font-medium text-soil-700"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-brown-300 bg-white px-3 py-2 font-sans text-sm text-soil-900 placeholder:text-soil-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
            />
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-4 block text-center text-sm text-soil-600">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="font-medium text-green-700 hover:underline"
          >
            Get started
          </button>
        </p>
        <p className="mt-2 block text-center text-sm text-soil-400">
          Need help? Email{" "}
          <a href="mailto:hello@jninty.com" className="text-green-700 hover:underline">
            hello@jninty.com
          </a>
        </p>
      </div>
    </div>
  );
}
