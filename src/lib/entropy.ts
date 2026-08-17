import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

export type EntropyMode = "coin" | "dice" | "cards" | "hex";

export interface ParsedEntropy {
  events: string[];
  normalized: string;
  invalidCount: number;
  duplicateCount: number;
  estimatedBits: number;
}

const CARD_PATTERN = /^(A|[2-9]|10|J|Q|K)(C|D|H|S)$/i;

export function parseEntropy(mode: EntropyMode, raw: string): ParsedEntropy {
  if (mode === "coin") {
    const events = [...raw].filter((char) => char === "0" || char === "1");
    const invalidCount = [...raw].filter(
      (char) => !/[01\s,.;:_|/-]/.test(char),
    ).length;
    return {
      events,
      normalized: events.join(""),
      invalidCount,
      duplicateCount: 0,
      estimatedBits: events.length,
    };
  }

  if (mode === "dice") {
    const events = [...raw].filter((char) => /[1-6]/.test(char));
    const invalidCount = [...raw].filter(
      (char) => !/[1-6\s,.;:_|/-]/.test(char),
    ).length;
    return {
      events,
      normalized: events.join(""),
      invalidCount,
      duplicateCount: 0,
      estimatedBits: events.length * Math.log2(6),
    };
  }

  if (mode === "cards") {
    const tokens = raw
      .toUpperCase()
      .replaceAll("♣", "C")
      .replaceAll("♦", "D")
      .replaceAll("♥", "H")
      .replaceAll("♠", "S")
      .split(/[\s,.;:_|/\\-]+/)
      .filter(Boolean);
    const validTokens = tokens.filter((token) => CARD_PATTERN.test(token));
    const events: string[] = [];
    let duplicateCount = 0;
    for (const token of validTokens) {
      if (events.includes(token)) duplicateCount += 1;
      else events.push(token);
    }
    const estimatedBits = events.reduce(
      (bits, _token, index) => bits + Math.log2(52 - index),
      0,
    );
    return {
      events,
      normalized: events.join(" "),
      invalidCount: tokens.length - validTokens.length,
      duplicateCount,
      estimatedBits,
    };
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, "");
  const valid = [...normalized].filter((char) => /[0-9a-f]/.test(char));
  return {
    events: valid,
    normalized: valid.join(""),
    invalidCount: normalized.length - valid.length,
    duplicateCount: 0,
    estimatedBits: valid.length * 4,
  };
}

export function sourceToEntropyHex(
  mode: EntropyMode,
  parsed: ParsedEntropy,
  targetBits: 128 | 256,
): string | null {
  if (!parsed.normalized) return null;

  if (mode === "hex") {
    const targetCharacters = targetBits / 4;
    if (parsed.normalized.length < targetCharacters) return null;
    if (parsed.normalized.length === targetCharacters) return parsed.normalized;
    // Hex represents bytes. Wait for the second nibble instead of silently
    // padding an incomplete final byte.
    if (parsed.normalized.length % 2 !== 0) return null;
    const digest = bytesToHex(sha256(hexToBytes(parsed.normalized)));
    return digest.slice(0, targetCharacters);
  }

  const canonical = `entropy-workbench:v1|${mode}|${parsed.normalized}`;
  const digest = bytesToHex(sha256(utf8ToBytes(canonical)));
  return digest.slice(0, targetBits / 4);
}

export function canonicalInput(mode: EntropyMode, normalized: string) {
  return `entropy-workbench:v1|${mode}|${normalized}`;
}

export function generateSecureEntropyHex(targetBits: 128 | 256) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generation is not available in this browser.");
  }
  const bytes = new Uint8Array(targetBits / 8);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function requiredEvents(mode: EntropyMode, targetBits: 128 | 256) {
  if (mode === "coin") return targetBits;
  if (mode === "dice") return Math.ceil(targetBits / Math.log2(6));
  if (mode === "hex") return targetBits / 4;
  let bits = 0;
  for (let count = 1; count <= 52; count += 1) {
    bits += Math.log2(53 - count);
    if (bits >= targetBits) return count;
  }
  return null;
}

export function formatCrackTime(bits: number) {
  if (bits <= 0) return "No search space yet";
  const logYears =
    bits * Math.log10(2) - Math.log10(2) - 12 - Math.log10(31_556_952);
  if (logYears < -5) return "less than a minute";
  if (logYears < -2) return "less than a day";
  if (logYears < 0) return "less than a year";
  if (logYears < 3) return `${Math.max(1, Math.round(10 ** logYears)).toLocaleString()} years`;
  return `~10^${Math.floor(logYears)} years`;
}
