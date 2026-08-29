import { describe, expect, it } from "vitest";
import { buildMnemonicDetails } from "./crypto";
import {
  canonicalInput,
  extractorInput,
  generateSecureEntropyHex,
  generateSecureTranscript,
  parseEntropy,
  requiredEvents,
  sourceToEntropyHex,
} from "./entropy";

describe("physical entropy parsing", () => {
  it("normalizes coin separators without inventing events", () => {
    const parsed = parseEntropy("coin", "0, 1 / 0 x 1");

    expect(parsed.normalized).toBe("0101");
    expect(parsed.estimatedBits).toBe(4);
    expect(parsed.invalidCount).toBe(1);
  });

  it("counts dice entropy and rejects impossible faces", () => {
    const parsed = parseEntropy("dice", "1 2 3 4 5 6 7");

    expect(parsed.normalized).toBe("123456");
    expect(parsed.estimatedBits).toBeCloseTo(6 * Math.log2(6));
    expect(parsed.invalidCount).toBe(1);
    expect(requiredEvents("dice", 128)).toBe(50);
    expect(requiredEvents("dice", 256)).toBe(100);
  });

  it("keeps a card only once within a shuffled deck", () => {
    const parsed = parseEntropy("cards", "A♠ KH AS 10♦ nope");

    expect(parsed.normalized).toBe("AS KH 10D");
    expect(parsed.duplicateCount).toBe(1);
    expect(parsed.invalidCount).toBe(1);
    expect(requiredEvents("cards", 128)).not.toBeNull();
    expect(requiredEvents("cards", 256)).toBeNull();
  });

  it("accepts only a complete camera capture digest without estimating sensor entropy", () => {
    const complete = parseEntropy("camera", "ab".repeat(32));
    const incomplete = parseEntropy("camera", "ab".repeat(31));

    expect(complete.events).toHaveLength(1);
    expect(complete.estimatedBits).toBe(256);
    expect(incomplete.events).toHaveLength(0);
    expect(incomplete.estimatedBits).toBe(0);
    expect(requiredEvents("camera", 128)).toBe(1);
  });
});

describe("entropy extraction", () => {
  it("generates exact-size entropy with the browser CSPRNG", () => {
    expect(generateSecureEntropyHex(128)).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSecureEntropyHex(256)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a valid transcript for the selected source", () => {
    const coins = parseEntropy("coin", generateSecureTranscript("coin", 128));
    const dice = parseEntropy("dice", generateSecureTranscript("dice", 256));
    const cards128 = parseEntropy("cards", generateSecureTranscript("cards", 128));
    const cards256 = parseEntropy("cards", generateSecureTranscript("cards", 256));
    const hex = parseEntropy("hex", generateSecureTranscript("hex", 256));

    expect(coins.events).toHaveLength(128);
    expect(coins.invalidCount).toBe(0);
    expect(dice.events).toHaveLength(100);
    expect(dice.invalidCount).toBe(0);
    expect(cards128.events).toHaveLength(25);
    expect(cards128.duplicateCount).toBe(0);
    expect(cards256.events).toHaveLength(52);
    expect(cards256.estimatedBits).toBeLessThan(256);
    expect(hex.normalized).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic and domain-separated for workbench extractors", () => {
    const parsed = parseEntropy("coin", "010101");
    const first = sourceToEntropyHex("coin", parsed, 128);
    const second = sourceToEntropyHex("coin", parsed, 128);

    expect(canonicalInput("coin", parsed.normalized)).toBe(
      "entropy-workbench:v1|coin|010101",
    );
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
  });

  it("matches Ian Coleman's fixed-length dice conversion", () => {
    const transcript =
      "123132132564641321315213132156446421354646464613212313215461235465464613213165464321315413515";
    const parsed = parseEntropy("dice", transcript);

    expect(parsed.events).toHaveLength(93);
    expect(extractorInput("dice", parsed.normalized)).toBe(
      "123132132504041321315213132150440421354040404013212313215401235405404013213105404321315413515",
    );
    const entropy128 = sourceToEntropyHex("dice", parsed, 128);
    const entropy256 = sourceToEntropyHex("dice", parsed, 256);

    expect(entropy128).toBe("517cce660b27abd819cd4ca4e1fcb2de");
    expect(entropy256).toBe(
      "517cce660b27abd819cd4ca4e1fcb2de09736c4eca7da2ad1cdcb412bdd18090",
    );
    expect(buildMnemonicDetails(entropy128!).mnemonic).toBe(
      "fabric toy office bind kingdom ugly grunt praise pilot avocado coach run",
    );
    expect(buildMnemonicDetails(entropy256!).mnemonic).toBe(
      "fabric toy office bind kingdom ugly grunt praise pilot avocado coach rose now renew depth exile pencil happy damp habit cloth trip across any",
    );
  });

  it("uses exact-size hexadecimal entropy directly", () => {
    const valid = parseEntropy("hex", "00 ".repeat(16));
    const short = parseEntropy("hex", "00".repeat(15));

    expect(sourceToEntropyHex("hex", valid, 128)).toBe("00".repeat(16));
    expect(sourceToEntropyHex("hex", short, 128)).toBeNull();
  });

  it("condenses oversized hexadecimal input instead of getting stuck", () => {
    const oversized = parseEntropy("hex", "00".repeat(33));
    const incompleteByte = parseEntropy("hex", `${"00".repeat(32)}f`);

    expect(sourceToEntropyHex("hex", oversized, 256)).toBe(
      "7f9c9e31ac8256ca2f258583df262dbc7d6f68f2a03043d5c99a4ae5a7396ce9",
    );
    expect(sourceToEntropyHex("hex", incompleteByte, 256)).toBeNull();
  });

  it("domain-separates a complete camera digest before producing BIP39 entropy", () => {
    const parsed = parseEntropy("camera", "ab".repeat(32));
    const invalid = parseEntropy("camera", `${"ab".repeat(32)}!`);

    expect(sourceToEntropyHex("camera", parsed, 128)).toMatch(/^[0-9a-f]{32}$/);
    expect(sourceToEntropyHex("camera", parsed, 256)).toMatch(/^[0-9a-f]{64}$/);
    expect(sourceToEntropyHex("camera", invalid, 128)).toBeNull();
    expect(canonicalInput("camera", parsed.normalized)).toBe(
      `entropy-workbench:v1|camera|${"ab".repeat(32)}`,
    );
  });
});
