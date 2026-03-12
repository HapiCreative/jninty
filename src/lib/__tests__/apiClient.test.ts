import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the new functions by mocking fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the config module
vi.mock("../../config/cloud", () => ({
  apiUrl: "https://api.test.com",
}));

describe("apiClient billing functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("jninty_auth_token", "test-token");
  });

  it("cancelSubscription sends POST to /billing/cancel", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "u1",
          email: "a@b.com",
          plan: "monthly",
          subscriptionStatus: "cancelled",
          subscriptionEndsAt: "2026-04-10",
        }),
    });

    const { cancelSubscription } = await import("../apiClient");
    const user = await cancelSubscription();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/billing/cancel",
      expect.objectContaining({ method: "POST" }),
    );
    expect(user.subscriptionStatus).toBe("cancelled");
  });

  it("reactivateSubscription sends POST to /billing/reactivate", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "u1",
          email: "a@b.com",
          plan: "monthly",
          subscriptionStatus: "active",
          subscriptionEndsAt: "2026-04-10",
        }),
    });

    const { reactivateSubscription } = await import("../apiClient");
    const user = await reactivateSubscription();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/billing/reactivate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(user.subscriptionStatus).toBe("active");
  });

  it("changePlan sends POST to /billing/change-plan with priceId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "u1",
          email: "a@b.com",
          plan: "annual",
          subscriptionStatus: "active",
          subscriptionEndsAt: "2027-03-10",
        }),
    });

    const { changePlan } = await import("../apiClient");
    const user = await changePlan("price_annual_123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/billing/change-plan",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ priceId: "price_annual_123" }),
      }),
    );
    expect(user.plan).toBe("annual");
  });
});
