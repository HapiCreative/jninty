import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the auth store to return an authenticated user
vi.mock("../../store/authStore", () => ({
  useAuth: () => ({
    state: {
      isAuthenticated: true,
      user: {
        id: "u1",
        email: "test@example.com",
        plan: "monthly",
        subscriptionStatus: "active",
        subscriptionEndsAt: "2026-04-10",
      },
      token: "tok",
      isLoading: false,
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock("../../config/cloud", () => ({
  isCloudEnabled: true,
  apiUrl: "https://api.test.com",
  stripeMonthlyPriceId: "price_monthly",
  stripeAnnualPriceId: "price_annual",
  monthlyPrice: "$4.99/mo",
  annualPrice: "$49.99/yr",
}));

vi.mock("../../lib/apiClient", () => ({
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  changePlan: vi.fn(),
  getSubscriptionPortalUrl: vi.fn(),
}));

describe("CloudSyncSettings (authenticated)", () => {
  it("renders subscription actions for active user", async () => {
    const { default: CloudSyncSettings } = await import("./CloudSyncSettings");
    render(<CloudSyncSettings />);

    expect(screen.getByText("Cancel Subscription")).toBeInTheDocument();
    expect(screen.getByText(/Switch to Annual/)).toBeInTheDocument();
    expect(screen.getByText("Payment & Invoices ↗")).toBeInTheDocument();
  });

  it("renders user email and plan badge", async () => {
    const { default: CloudSyncSettings } = await import("./CloudSyncSettings");
    render(<CloudSyncSettings />);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("monthly")).toBeInTheDocument();
  });
});
