/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { GlossaryProvider } from "./components/glossary-term";

afterEach(() => cleanup());

function renderApp() {
  window.print = vi.fn();
  return render(
    <GlossaryProvider delayDuration={0}>
      <App />
    </GlossaryProvider>,
  );
}

describe("sensitive reveal transitions", () => {
  it("conceals every reveal and blocks backup while presentation mode is active", () => {
    renderApp();

    fireEvent.change(screen.getByLabelText("Coins entropy transcript"), {
      target: { value: "0".repeat(128) },
    });

    const passphrase = screen.getByLabelText("Optional BIP39 passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Show passphrase" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal seed" }));
    expect(passphrase).toHaveProperty("type", "text");
    expect(screen.getByRole("button", { name: "Hide seed" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Backup sheet" }));
    expect(screen.getByRole("heading", { name: "Verify your paper backup" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Optional BIP39 passphrase")).toHaveProperty("type", "password");
    expect(screen.getByRole("button", { name: "Reveal seed" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show passphrase" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal seed" }));
    fireEvent.change(screen.getByLabelText("Coins entropy transcript"), {
      target: { value: `1${"0".repeat(127)}` },
    });
    expect(screen.getByLabelText("Optional BIP39 passphrase")).toHaveProperty("type", "password");
    expect(screen.getByRole("button", { name: "Reveal seed" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show passphrase" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal seed" }));
    fireEvent.click(screen.getByRole("button", { name: "Presentation mode" }));
    expect(screen.getByLabelText("Optional BIP39 passphrase")).toHaveProperty("type", "password");
    expect(screen.getByRole("button", { name: "Reveal seed" })).toBeTruthy();
    const backup = screen.getByRole("button", { name: "Backup sheet" });
    expect(backup).toHaveProperty("disabled", true);

    fireEvent.click(backup);
    expect(screen.queryByRole("heading", { name: "Verify your paper backup" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show private data" }));
    expect(backup).toHaveProperty("disabled", false);
  });
});

describe("camera entropy controls", () => {
  it("keeps the camera off until the user explicitly starts it", () => {
    renderApp();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Camera" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(screen.getByRole("button", { name: "Start camera" })).toBeTruthy();
    expect(screen.getByText(/Camera entropy cannot be measured reliably/)).toBeTruthy();
    expect(screen.getByText(/Sensor entropy is not quantifiable/)).toBeTruthy();
  });
});
