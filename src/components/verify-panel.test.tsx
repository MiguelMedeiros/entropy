/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MnemonicDetails } from "../lib/crypto";
import { VerifyPanel } from "./verify-panel";

afterEach(() => cleanup());

const words = [
  "abandon", "ability", "able", "about", "above", "absent",
  "absorb", "abstract", "absurd", "abuse", "access", "accident",
];

const details: MnemonicDetails = {
  entropyHex: "00",
  entropyBits: "0",
  hashHex: "00",
  checksumBits: "0",
  combinedBits: "0",
  chunks: [],
  words,
  mnemonic: words.join(" "),
};

function props(overrides: Partial<React.ComponentProps<typeof VerifyPanel>> = {}) {
  return {
    kind: "hex" as const,
    onKindChange: vi.fn(),
    input: "",
    onInputChange: vi.fn(),
    error: null,
    details: null,
    expectedAddress: "",
    onExpectedAddressChange: vi.fn(),
    expectedPublicKey: "",
    onExpectedPublicKeyChange: vi.fn(),
    actualAddress: "bc1qactual",
    actualPublicKey: "02abcdef",
    completionCandidateCount: 0,
    completionMissingBits: null,
    completedMnemonic: "",
    onCompletePhrase: vi.fn(),
    ...overrides,
  };
}

describe("VerifyPanel", () => {
  it("shows validation feedback and forwards mode and input changes", () => {
    const onKindChange = vi.fn();
    const onInputChange = vi.fn();

    render(
      <VerifyPanel
        {...props({
          error: "Entropy must contain only hexadecimal characters.",
          details,
          onKindChange,
          onInputChange,
        })}
      />,
    );

    expect(screen.getByText("Valid 12-word BIP39 result")).toBeTruthy();
    expect(screen.getByText("Entropy must contain only hexadecimal characters.")).toBeTruthy();
    expect(screen.getByText("Mnemonic/checksum is valid")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("BIP39 entropy"), { target: { value: "00ff" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Verify mnemonic" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(onInputChange).toHaveBeenCalledWith("00ff");
    expect(onKindChange).toHaveBeenCalledWith("mnemonic");
  });

  it("compares results case-insensitively, trims expected values, and waits for blank values", () => {
    render(
      <VerifyPanel
        {...props({
          expectedAddress: "  BC1QACTUAL  ",
          expectedPublicKey: "02deadbeef",
        })}
      />,
    );

    expect(screen.getByText("First address matches")).toBeTruthy();
    expect(screen.getByText("Public key does not match")).toBeTruthy();
    expect(screen.getByText("Waiting for a valid input")).toBeTruthy();
  });

  it("offers secure completion only when candidates and missing-bit data are available", () => {
    const onCompletePhrase = vi.fn();
    const completedMnemonic = `${words.slice(0, 11).join(" ")} zoo`;
    const { rerender } = render(
      <VerifyPanel
        {...props({
          kind: "complete",
          completionCandidateCount: 128,
          completionMissingBits: null,
          onCompletePhrase,
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: "Generate final word securely" })).toBeNull();

    rerender(
      <VerifyPanel
        {...props({
          kind: "complete",
          completionCandidateCount: 128,
          completionMissingBits: 7,
          completedMnemonic,
          onCompletePhrase,
        })}
      />,
    );

    expect(screen.getByText("128 valid final words · 7 entropy bits still missing")).toBeTruthy();
    expect(screen.getByText(completedMnemonic)).toBeTruthy();
    expect(screen.getByText("zoo")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Choose another valid final word" }));
    expect(onCompletePhrase).toHaveBeenCalledOnce();
  });
});
