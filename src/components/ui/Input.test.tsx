import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Input from "./Input.tsx";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input aria-label="Name" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("forwards placeholder attribute", () => {
    render(<Input placeholder="Enter plant name" />);
    expect(screen.getByPlaceholderText("Enter plant name")).toBeInTheDocument();
  });

  it("supports disabled state", () => {
    render(<Input disabled aria-label="Disabled" />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("merges custom className", () => {
    render(<Input className="mt-2" aria-label="Styled" />);
    expect(screen.getByRole("textbox").className).toContain("mt-2");
  });

  it("forwards HTML input attributes", () => {
    render(<Input type="email" aria-label="Email" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
  });
});
