import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Card from "./Card.tsx";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies base styling classes", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("shadow-sm");
  });

  it("merges custom className", () => {
    render(<Card className="mt-8" data-testid="card">Content</Card>);
    expect(screen.getByTestId("card").className).toContain("mt-8");
  });

  it("forwards HTML div attributes", () => {
    render(<Card data-testid="card" id="my-card">Content</Card>);
    expect(screen.getByTestId("card")).toHaveAttribute("id", "my-card");
  });
});
