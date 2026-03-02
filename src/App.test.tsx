import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { clearPouchDB } from "./db/pouchdb/testUtils.ts";
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
