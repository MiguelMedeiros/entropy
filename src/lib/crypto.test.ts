import { describe, expect, it } from "vitest";
import { bytesToHex } from "@noble/hashes/utils";
import { createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import {
  buildMnemonicDetails,
  buildMnemonicDetailsFromWords,
  chooseSecureLastWord,
  chooseSecureIndices,
  deriveBip84Addresses,
  deriveSeedHex,
  deriveWalletIdentity,
  getLastWordCandidates,
} from "./crypto";

const ZERO_ENTROPY = "00000000000000000000000000000000";
const ZERO_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("BIP39", () => {
  it("matches the official zero-entropy mnemonic vector", () => {
    const details = buildMnemonicDetails(ZERO_ENTROPY);

    expect(details.mnemonic).toBe(ZERO_MNEMONIC);
    expect(details.checksumBits).toBe("0011");
    expect(details.chunks).toHaveLength(12);
  });

  it("matches the official TREZOR passphrase seed vector", () => {
    expect(deriveSeedHex(ZERO_MNEMONIC, "TREZOR")).toBe(
      "c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04",
    );
  });

  it("recovers entropy from a normalized mnemonic and rejects bad checksums", () => {
    expect(buildMnemonicDetailsFromWords(`  ${ZERO_MNEMONIC.toUpperCase()}  `).entropyHex).toBe(ZERO_ENTROPY);
    expect(() => buildMnemonicDetailsFromWords(`${ZERO_MNEMONIC.replace(/about$/, "abandon")}`)).toThrow(
      "Invalid BIP39 mnemonic or checksum.",
    );
  });

  it("finds all 128 valid final words for an 11-word partial mnemonic", () => {
    const completion = getLastWordCandidates(Array(11).fill("abandon").join(" "));

    expect(completion.candidates).toHaveLength(128);
    expect(completion.candidates).toContain("about");
    expect(completion.missingEntropyBits).toBe(7);
    expect(completion.finalWordCount).toBe(12);
  });

  it("finds all 8 valid final words for a 23-word partial mnemonic", () => {
    const completion = getLastWordCandidates(Array(23).fill("abandon").join(" "));

    expect(completion.candidates).toHaveLength(8);
    expect(completion.candidates).toContain("art");
    expect(completion.missingEntropyBits).toBe(3);
    expect(completion.finalWordCount).toBe(24);
  });

  it("securely chooses only from valid candidates and rejects invalid partial words", () => {
    const completion = getLastWordCandidates(Array(11).fill("abandon").join(" "));
    expect(completion.candidates).toContain(chooseSecureLastWord(completion.candidates));
    expect(() => getLastWordCandidates(`${Array(10).fill("abandon").join(" ")} notaword`)).toThrow(
      "not in the English BIP39 word list",
    );
  });

  it("selects distinct in-range positions for backup verification", () => {
    const positions = chooseSecureIndices(24, 3);

    expect(positions).toHaveLength(3);
    expect(new Set(positions).size).toBe(3);
    expect(positions.every((position) => position >= 0 && position < 24)).toBe(true);
  });
});

describe("BIP84", () => {
  it("matches the official first receiving-address vector", () => {
    const [first] = deriveBip84Addresses(ZERO_MNEMONIC, "", 1);

    expect(first.path).toBe("m/84'/0'/0'/0/0");
    expect(first.publicKey).toBe(
      "0330d54fd0dd420a6e5f8d3624f5f3482cae350f79d5f0753bf5beef9c2d91af3c",
    );
    expect(first.address).toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
    expect(first.publicKeyHash).toBe("c0cebcd6c3d3ca8c75dc5ec62ebe55330ef910e2");
    expect(first.scriptPubKey).toBe("0014c0cebcd6c3d3ca8c75dc5ec62ebe55330ef910e2");

    const decodedWif = createBase58check(sha256).decode(first.wif);
    expect(decodedWif[0]).toBe(0x80);
    expect(decodedWif.at(-1)).toBe(0x01);
    expect(bytesToHex(decodedWif.slice(1, -1))).toBe(first.privateKey);
  });

  it("matches the official BIP84 account identity vector", () => {
    const identity = deriveWalletIdentity(ZERO_MNEMONIC, "");

    expect(identity.masterFingerprint).toBe("73c5da0a");
    expect(identity.accountPath).toBe("m/84'/0'/0'");
    expect(identity.accountXpub.startsWith("xpub")).toBe(true);
    expect(identity.accountZpub).toBe(
      "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs",
    );
  });
});
