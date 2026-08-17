import { describe, expect, it } from "vitest";
import {
  canonicalInput,
  generateSecureEntropyHex,
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
});

describe("entropy extraction", () => {
  it("generates exact-size entropy with the browser CSPRNG", () => {
    expect(generateSecureEntropyHex(128)).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSecureEntropyHex(256)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic and domain-separated", () => {
    const parsed = parseEntropy("coin", "010101");
    const first = sourceToEntropyHex("coin", parsed, 128);
    const second = sourceToEntropyHex("coin", parsed, 128);

    expect(canonicalInput("coin", parsed.normalized)).toBe(
      "entropy-workbench:v1|coin|010101",
    );
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
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
});
