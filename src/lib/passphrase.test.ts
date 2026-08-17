import { describe, expect, it } from "vitest";
import { estimatePassphraseStrength, formatEstimatedGuesses } from "./passphrase";

describe("passphrase strength", () => {
  it("treats an empty optional passphrase as a neutral state", () => {
    expect(estimatePassphraseStrength("")).toBeNull();
  });

  it("rates a long unrelated phrase above a common password", () => {
    const common = estimatePassphraseStrength("password")!;
    const unrelated = estimatePassphraseStrength("velvet orbit cactus harbor lantern quartz")!;

    expect(common.score).toBeLessThanOrEqual(1);
    expect(unrelated.score).toBeGreaterThan(common.score);
    expect(unrelated.guessesLog10).toBeGreaterThan(common.guessesLog10);
  });

  it("formats the pattern-aware search-space estimate", () => {
    expect(formatEstimatedGuesses(2.8)).toBe("fewer than 1,000 guesses");
    expect(formatEstimatedGuesses(12.9)).toBe("about 10^12 guesses");
  });
});
