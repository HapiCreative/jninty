import { useState, type ReactNode } from "react";
import { isCloudEnabled } from "../../config/cloud";
import { useAuth } from "../../store/authStore";
import LoginModal from "./LoginModal";
import SignUpModal from "./SignUpModal";

function hasActiveSubscription(
  status: string,
  endsAt: string | null,
): boolean {
  if (status === "active") return true;
  // Cancelled but still within the paid period
  if (status === "cancelled" && endsAt) {
    return new Date(endsAt) > new Date();
  }
  return false;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-text-muted">Loading...</span>
      </div>
    </div>
  );
}

function PaywallScreen() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-text-heading">
          Jninty Cloud
        </h1>
        <p className="mt-2 text-text-secondary">
          Sign in or create an account to start using Jninty.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className="rounded-lg border border-border-strong bg-surface-elevated px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setShowSignUp(true)}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover"
          >
            Get Started
          </button>
        </div>

        <LoginModal
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
          onSwitchToSignUp={() => {
            setShowLogin(false);
            setShowSignUp(true);
          }}
        />
        <SignUpModal
          isOpen={showSignUp}
          onClose={() => setShowSignUp(false)}
          onSwitchToLogin={() => {
            setShowSignUp(false);
            setShowLogin(true);
          }}
        />
      </div>
    </div>
  );
}

function ExpiredScreen() {
  const { performLogout } = useAuth();

  function handleSignOut() {
    performLogout();
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-text-heading">
          Subscription Expired
        </h1>
        <p className="mt-2 text-text-secondary">
          Your Jninty Cloud subscription has expired. Renew to continue using
          the app.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-border-strong bg-surface-elevated px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
          >
            Sign Out
          </button>
          <a
            href="mailto:hello@jninty.com"
            className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

export default function CloudGate({ children }: { children: ReactNode }) {
  const { state } = useAuth();

  // OSS mode — no gate
  if (!isCloudEnabled) return <>{children}</>;

  // Validating auth session
  if (state.isLoading) return <LoadingScreen />;

  // Not logged in
  if (!state.isAuthenticated || !state.user) return <PaywallScreen />;

  // Logged in but subscription lapsed
  if (
    !hasActiveSubscription(
      state.user.subscriptionStatus,
      state.user.subscriptionEndsAt,
    )
  ) {
    return <ExpiredScreen />;
  }

  return <>{children}</>;
}
