import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db/schema.ts";
import App from "./App.tsx";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("App", () => {
  it("renders the app shell with navigation", () => {
    render(<App />);
    expect(screen.getAllByText("Jninty").length).toBeGreaterThan(0);
    expect(
      screen.getByText("What's happening in your garden today?"),
    ).toBeInTheDocument();
  });
});
