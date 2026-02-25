import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Badge from "./Badge.tsx";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant by default", () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText("Status").className).toContain("bg-cream-200");
  });

  it("applies success variant classes", () => {
    render(<Badge variant="success">Healthy</Badge>);
    expect(screen.getByText("Healthy").className).toContain("bg-green-100");
  });

  it("applies warning variant classes", () => {
    render(<Badge variant="warning">Needs water</Badge>);
    expect(screen.getByText("Needs water").className).toContain("bg-brown-100");
  });

  it("applies danger variant classes", () => {
    render(<Badge variant="danger">Pest</Badge>);
    expect(screen.getByText("Pest").className).toContain("terracotta");
  });

  it("merges custom className", () => {
    render(<Badge className="ml-2">Tag</Badge>);
    expect(screen.getByText("Tag").className).toContain("ml-2");
  });
});
