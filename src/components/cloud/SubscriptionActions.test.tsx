import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubscriptionActions from "./SubscriptionActions";
import type { AuthUser } from "../../types/auth";

// Mock API client
vi.mock("../../lib/apiClient", () => ({
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  changePlan: vi.fn(),
  getSubscriptionPortalUrl: vi.fn(),
}));

vi.mock("../../config/cloud", () => ({
  stripeMonthlyPriceId: "price_monthly",
  stripeAnnualPriceId: "price_annual",
  monthlyPrice: "$4.99/mo",
  annualPrice: "$49.99/yr",
}));

const baseUser: AuthUser = {
  id: "u1",
  email: "test@example.com",
  plan: "monthly",
  subscriptionStatus: "active",
  subscriptionEndsAt: "2026-04-10",
};

describe("SubscriptionActions", () => {
  const onUserUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Cancel and Switch to Annual buttons for active monthly user", () => {
    render(
      <SubscriptionActions user={baseUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Cancel Subscription")).toBeInTheDocument();
    expect(screen.getByText(/Switch to Annual/)).toBeInTheDocument();
  });

  it("shows Cancel and Switch to Monthly buttons for active annual user", () => {
    const annualUser = { ...baseUser, plan: "annual" };
    render(
      <SubscriptionActions user={annualUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Cancel Subscription")).toBeInTheDocument();
    expect(screen.getByText(/Switch to Monthly/)).toBeInTheDocument();
  });

  it("shows Reactivate button for cancelled user", () => {
    const cancelledUser = { ...baseUser, subscriptionStatus: "cancelled" as const };
    render(
      <SubscriptionActions user={cancelledUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Reactivate Subscription")).toBeInTheDocument();
    expect(screen.queryByText("Cancel Subscription")).not.toBeInTheDocument();
  });

  it("shows Resubscribe button for expired user", () => {
    const expiredUser = { ...baseUser, subscriptionStatus: "expired" as const };
    render(
      <SubscriptionActions user={expiredUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Resubscribe")).toBeInTheDocument();
  });

  it("shows confirm modal when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SubscriptionActions user={baseUser} onUserUpdated={onUserUpdated} />,
    );

    await user.click(screen.getByText("Cancel Subscription"));
    expect(
      screen.getByText(/You'll continue to have access until/),
    ).toBeInTheDocument();
  });

  it("always shows Payment & Invoices link", () => {
    render(
      <SubscriptionActions user={baseUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Payment & Invoices ↗")).toBeInTheDocument();
  });
});
