import { useState } from "react";
import { format } from "date-fns";
import { isCloudEnabled, apiUrl } from "../../config/cloud";
import { useAuth } from "../../store/authStore";
import type { AuthUser } from "../../types/auth";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import LoginModal from "./LoginModal";
import SignUpModal from "./SignUpModal";
import SubscriptionActions from "./SubscriptionActions";

export default function CloudSyncSettings() {
  const { state, dispatch } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  if (!isCloudEnabled) return null;

  function handleSwitchToSignUp() {
    setShowLogin(false);
    setShowSignUp(true);
  }

  function handleSwitchToLogin() {
    setShowSignUp(false);
    setShowLogin(true);
  }

  function handleUserUpdated(updated: AuthUser) {
    dispatch({ type: "UPDATE_USER", payload: updated });
  }

  // Not authenticated
  if (!state.isAuthenticated) {
    return (
      <>
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Jninty Cloud Sync
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Sync your garden data across all your devices. Your data is always
            stored locally — cloud sync is optional.
          </p>

          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => setShowLogin(true)}>
              Sign In
            </Button>
            <Button onClick={() => setShowSignUp(true)}>Get Started</Button>
          </div>

          {apiUrl && (
            <a
              href={apiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-text-muted hover:underline"
            >
              Learn more about Jninty Cloud &#8599;
            </a>
          )}
        </Card>

        <LoginModal
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
          onSwitchToSignUp={handleSwitchToSignUp}
        />
        <SignUpModal
          isOpen={showSignUp}
          onClose={() => setShowSignUp(false)}
          onSwitchToLogin={handleSwitchToLogin}
        />
      </>
    );
  }

  // Authenticated
  const { user } = state;
  if (!user) return null;

  const subscriptionBadge = (() => {
    switch (user.subscriptionStatus) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "cancelled":
        return (
          <Badge variant="warning">
            Cancels on{" "}
            {user.subscriptionEndsAt
              ? format(new Date(user.subscriptionEndsAt), "MMM dd, yyyy")
              : "—"}
          </Badge>
        );
      case "expired":
        return <Badge variant="danger">Expired</Badge>;
    }
  })();

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-text-heading">
        Manage Subscription
      </h2>

      <div className="mt-4 space-y-4">
        {/* User info */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">{user.email}</span>
          <div className="flex items-center gap-2">
            <Badge>{user.plan}</Badge>
            {subscriptionBadge}
          </div>
        </div>

        {/* Subscription details */}
        <div className="text-sm text-text-secondary space-y-1">
          {user.subscriptionEndsAt && (
            <p>
              {user.subscriptionStatus === "cancelled" ? "Access until" : "Renews on"}:{" "}
              <span className="font-medium">
                {format(new Date(user.subscriptionEndsAt), "MMM dd, yyyy")}
              </span>
            </p>
          )}
        </div>

        {/* Actions */}
        <SubscriptionActions user={user} onUserUpdated={handleUserUpdated} />
      </div>
    </Card>
  );
}
