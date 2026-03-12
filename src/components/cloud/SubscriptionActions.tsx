import { useState } from "react";
import { format } from "date-fns";
import type { AuthUser } from "../../types/auth";
import {
  cancelSubscription,
  reactivateSubscription,
  changePlan,
  getSubscriptionPortalUrl,
} from "../../lib/apiClient";
import {
  stripeMonthlyPriceId,
  stripeAnnualPriceId,
  monthlyPrice,
  annualPrice,
} from "../../config/cloud";
import Button from "../ui/Button";
import ConfirmModal from "../ui/ConfirmModal";

interface Props {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
}

type ModalType = "cancel" | "change-plan" | null;

export default function SubscriptionActions({ user, onUserUpdated }: Props) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const isMonthly = user.plan === "monthly";
  const targetPlan = isMonthly ? "annual" : "monthly";
  const targetPriceId = isMonthly ? stripeAnnualPriceId : stripeMonthlyPriceId;
  const targetPrice = isMonthly ? annualPrice : monthlyPrice;

  async function handleCancel() {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await cancelSubscription();
      onUserUpdated(updated);
      setActiveModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel subscription");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReactivate() {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await reactivateSubscription();
      onUserUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reactivate subscription");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChangePlan() {
    if (!targetPriceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const updated = await changePlan(targetPriceId);
      onUserUpdated(updated);
      setActiveModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change plan");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenPortal() {
    setPortalLoading(true);
    try {
      const { url } = await getSubscriptionPortalUrl();
      window.location.href = url;
    } catch {
      setPortalLoading(false);
    }
  }

  const renewalDate = user.subscriptionEndsAt
    ? format(new Date(user.subscriptionEndsAt), "MMM dd, yyyy")
    : null;

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Active subscription actions */}
      {user.subscriptionStatus === "active" && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => setActiveModal("change-plan")}
          >
            Switch to {targetPlan === "annual" ? "Annual" : "Monthly"} ({targetPrice})
          </Button>
          <Button
            variant="secondary"
            onClick={() => setActiveModal("cancel")}
          >
            Cancel Subscription
          </Button>
        </div>
      )}

      {/* Cancelled — offer reactivation */}
      {user.subscriptionStatus === "cancelled" && (
        <div className="space-y-2">
          <p className="text-sm text-text-muted">
            Your subscription is cancelled but you have access until{" "}
            <span className="font-medium">{renewalDate}</span>.
          </p>
          <Button
            onClick={() => void handleReactivate()}
            disabled={isLoading}
          >
            {isLoading ? "Reactivating..." : "Reactivate Subscription"}
          </Button>
        </div>
      )}

      {/* Expired — link to resubscribe (goes through Stripe portal) */}
      {user.subscriptionStatus === "expired" && (
        <div className="space-y-2">
          <p className="text-sm text-text-muted">
            Your subscription has expired. Resubscribe to restore cloud sync.
          </p>
          <Button
            onClick={() => void handleOpenPortal()}
            disabled={portalLoading}
          >
            {portalLoading ? "Loading..." : "Resubscribe"}
          </Button>
        </div>
      )}

      {/* Payment & invoices — always visible */}
      <button
        type="button"
        className="text-sm text-green-700 hover:underline disabled:opacity-50"
        onClick={() => void handleOpenPortal()}
        disabled={portalLoading}
      >
        Payment &amp; Invoices &#8599;
      </button>

      {/* Cancel confirmation modal */}
      <ConfirmModal
        isOpen={activeModal === "cancel"}
        title="Cancel Subscription"
        message={`You'll continue to have access until ${renewalDate ?? "the end of your billing period"}. After that, cloud sync will stop but your local data is always safe.`}
        confirmLabel="Yes, Cancel"
        variant="danger"
        isLoading={isLoading}
        onConfirm={() => void handleCancel()}
        onCancel={() => setActiveModal(null)}
      />

      {/* Change plan confirmation modal */}
      <ConfirmModal
        isOpen={activeModal === "change-plan"}
        title={`Switch to ${targetPlan === "annual" ? "Annual" : "Monthly"} Plan`}
        message={`You'll be switched to the ${targetPlan} plan at ${targetPrice}. The change takes effect at your next billing date.`}
        confirmLabel="Switch Plan"
        variant="primary"
        isLoading={isLoading}
        onConfirm={() => void handleChangePlan()}
        onCancel={() => setActiveModal(null)}
      />
    </div>
  );
}
