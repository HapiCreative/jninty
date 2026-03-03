import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Button from "./Button.tsx";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("applies primary variant by default", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-primary");
  });

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Cancel</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-surface-muted");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">More</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-transparent");
  });

  it("forwards HTML button attributes", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("merges custom className", () => {
    render(<Button className="mt-4">Styled</Button>);
    expect(screen.getByRole("button").className).toContain("mt-4");
  });
});
