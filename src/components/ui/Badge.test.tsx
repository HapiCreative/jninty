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
    expect(screen.getByText("Status").className).toContain("bg-surface-muted");
  });

  it("applies success variant classes", () => {
    render(<Badge variant="success">Healthy</Badge>);
    expect(screen.getByText("Healthy").className).toContain("bg-status-success-bg");
  });

  it("applies warning variant classes", () => {
    render(<Badge variant="warning">Needs water</Badge>);
    expect(screen.getByText("Needs water").className).toContain("bg-status-warning-bg");
  });

  it("applies danger variant classes", () => {
    render(<Badge variant="danger">Pest</Badge>);
    expect(screen.getByText("Pest").className).toContain("status-danger");
  });

  it("merges custom className", () => {
    render(<Badge className="ml-2">Tag</Badge>);
    expect(screen.getByText("Tag").className).toContain("ml-2");
  });
});
