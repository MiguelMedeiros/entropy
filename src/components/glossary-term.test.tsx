/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GlossaryProvider, GlossaryTerm } from "./glossary-term";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => cleanup());
afterAll(() => vi.unstubAllGlobals());

function renderGlossaryTerm() {
  render(
    <GlossaryProvider delayDuration={0}>
      <GlossaryTerm definition="Randomness that makes a value hard to guess.">
        Entropy
      </GlossaryTerm>
    </GlossaryProvider>,
  );

  return screen.getByRole("button", { name: "Entropy" });
}

describe("GlossaryTerm", () => {
  it("shows its definition when clicked and hides it when clicked again", () => {
    const trigger = renderGlossaryTerm();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Randomness that makes a value hard to guess.",
    );

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes an open definition when Escape is pressed", () => {
    const trigger = renderGlossaryTerm();

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
