import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App.tsx";

describe("App", () => {
  it("renders the app shell with navigation", () => {
    render(<App />);
    expect(screen.getAllByText("Jninty").length).toBeGreaterThan(0);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
