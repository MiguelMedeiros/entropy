/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PassphraseStrength } from "../lib/passphrase";
import { PassphraseStrengthMeter } from "./passphrase-strength";

afterEach(() => cleanup());

function strength(overrides: Partial<PassphraseStrength> = {}): PassphraseStrength {
  return {
    score: 2,
    label: "Fair",
    guessesLog10: 6.8,
    warning: null,
    suggestions: ["Add another unrelated word."],
    ...overrides,
  };
}

describe("PassphraseStrengthMeter", () => {
  it("explains that an empty passphrase does not remove mnemonic security requirements", () => {
    render(<PassphraseStrengthMeter strength={null} />);

    expect(
      screen.getByText("No passphrase is valid. Wallet security still depends on protecting the mnemonic."),
    ).toBeTruthy();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("shows the label, estimate, accessible score, and warning for a measured passphrase", () => {
    render(
      <PassphraseStrengthMeter
        strength={strength({
          score: 1,
          label: "Weak",
          guessesLog10: 2.9,
          warning: "This is a common phrase.",
        })}
      />,
    );

    expect(screen.getByText("Weak")).toBeTruthy();
    expect(screen.getByText("This is a common phrase.")).toBeTruthy();
    expect(screen.getByText("fewer than 1,000 guesses")).toBeTruthy();
    expect(screen.queryByText("Add another unrelated word.")).toBeNull();

    const meter = screen.getByRole("meter", { name: "Passphrase strength" });
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("4");
    expect(meter.getAttribute("aria-valuenow")).toBe("1");
  });

  it("uses the safe fallback guidance when a strong result has no feedback", () => {
    render(
      <PassphraseStrengthMeter
        strength={strength({
          score: 4,
          label: "Very strong",
          guessesLog10: 12.4,
          suggestions: [],
        })}
      />,
    );

    expect(screen.getByText("No obvious common pattern was detected. Keep an exact separate backup.")).toBeTruthy();
    expect(screen.getByText("about 10^12 guesses")).toBeTruthy();
    expect(screen.getByText("Pattern-aware offline estimate, not a guarantee.")).toBeTruthy();
  });
});
