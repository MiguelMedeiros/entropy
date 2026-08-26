/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DerivedAddress, MnemonicDetails } from "../lib/crypto";
import { BackupSheet } from "./backup-sheet";

const chooseSecureIndices = vi.hoisted(() => vi.fn(() => [0, 5, 11]));

vi.mock("../lib/crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/crypto")>()),
  chooseSecureIndices,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  chooseSecureIndices.mockClear();
});

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

const firstAddress: DerivedAddress = {
  index: 0,
  path: "m/84'/0'/0'/0/0",
  publicKey: "02publickey",
  publicKeyHash: "public-key-hash",
  privateKey: "private-key",
  scriptPubKey: "script-pub-key",
  wif: "wif",
  address: "bc1qfirstaddress",
};

describe("BackupSheet", () => {
  it("renders the printable backup and exposes its navigation and print controls", () => {
    const onBack = vi.fn();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);

    render(
      <BackupSheet
        details={details}
        firstAddress={firstAddress}
        hasPassphrase
        onBack={onBack}
      />,
    );

    expect(screen.getByRole("heading", { name: "Bitcoin wallet backup" })).toBeTruthy();
    expect(screen.getByText("bc1qfirstaddress")).toBeTruthy();
    expect(screen.getByText("02publickey")).toBeTruthy();
    expect(screen.getByText("YES")).toBeTruthy();
    expect(screen.getByText("Store the passphrase separately", { exact: false })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Print backup" }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
  });

  it("requires every challenged word and accepts whitespace and letter-case differences", () => {
    const { container } = render(
      <BackupSheet details={details} hasPassphrase={false} onBack={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start backup check" }));

    expect(chooseSecureIndices).toHaveBeenCalledWith(12, 3);
    expect(container.querySelector(".backup-sheet")?.classList.contains("blur-md")).toBe(true);
    const verify = screen.getByRole("button", { name: "Verify words" });
    expect(verify).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Word 1"), { target: { value: " ABANDON " } });
    fireEvent.change(screen.getByLabelText("Word 6"), { target: { value: "Absent" } });
    fireEvent.change(screen.getByLabelText("Word 12"), { target: { value: " accident " } });

    expect(verify).toHaveProperty("disabled", false);
    fireEvent.click(verify);
    expect(screen.getByText("Backup check passed.")).toBeTruthy();
  });

  it("reports a mismatch, clears the result when edited, and handles absent address data", () => {
    render(<BackupSheet details={details} hasPassphrase={false} onBack={vi.fn()} />);

    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("NO")).toBeTruthy();
    expect(screen.queryByText("Store the passphrase separately", { exact: false })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Start backup check" }));
    fireEvent.change(screen.getByLabelText("Word 1"), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText("Word 6"), { target: { value: "absent" } });
    fireEvent.change(screen.getByLabelText("Word 12"), { target: { value: "accident" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify words" }));

    expect(screen.getByText("One or more words do not match. Check the paper carefully.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Word 1"), { target: { value: "abandon" } });
    expect(screen.queryByText("One or more words do not match. Check the paper carefully.")).toBeNull();
  });
});
