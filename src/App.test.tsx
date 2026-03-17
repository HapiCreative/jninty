import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearPouchDB } from "./db/pouchdb/testUtils.ts";

// Disable CloudGate so the test renders the actual app shell
vi.mock("./config/cloud", () => ({
  isCloudEnabled: false,
  apiUrl: undefined,
  stripePublishableKey: undefined,
  stripeMonthlyPriceId: undefined,
  stripeAnnualPriceId: undefined,
  monthlyPrice: "$4.99/mo",
  annualPrice: "$49.99/yr",
}));

import App from "./App.tsx";

beforeEach(async () => {
  await clearPouchDB();
});

describe("App", () => {
  it("renders the app shell with navigation", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText("Jninty").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(
        screen.getByText("What's happening in your garden today?"),
      ).toBeInTheDocument();
    });
  });
});
