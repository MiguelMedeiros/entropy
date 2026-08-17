import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, concatBytes, hexToBytes } from "@noble/hashes/utils";
import { bech32, createBase58check } from "@scure/base";
import { HDKey } from "@scure/bip32";
import {
  entropyToMnemonic,
  mnemonicToEntropy,
  mnemonicToSeedSync,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

export interface MnemonicDetails {
  entropyHex: string;
  entropyBits: string;
  hashHex: string;
  checksumBits: string;
  combinedBits: string;
  chunks: string[];
  words: string[];
  mnemonic: string;
}

export interface DerivedAddress {
  index: number;
  path: string;
  publicKey: string;
  publicKeyHash: string;
  privateKey: string;
  scriptPubKey: string;
  wif: string;
  address: string;
}

export interface CompletionCandidates {
  normalizedPartial: string;
  wordCount: 11 | 23;
  finalWordCount: 12 | 24;
  missingEntropyBits: 7 | 3;
  candidates: string[];
}

export interface WalletIdentity {
  masterFingerprint: string;
  accountPath: string;
  accountXpub: string;
  accountZpub: string;
}

const bip39Words = new Set(wordlist);
const base58check = createBase58check(sha256);
const BIP84_VERSIONS = { private: 0x04b2430c, public: 0x04b24746 };

export function buildMnemonicDetails(entropyHex: string): MnemonicDetails {
  const entropy = hexToBytes(entropyHex);
  const entropyBits = [...entropy]
    .map((byte) => byte.toString(2).padStart(8, "0"))
    .join("");
  const hashHex = bytesToHex(sha256(entropy));
  const checksumLength = entropyBits.length / 32;
  const checksumBits = BigInt(`0x${hashHex}`)
    .toString(2)
    .padStart(256, "0")
    .slice(0, checksumLength);
  const combinedBits = entropyBits + checksumBits;
  const chunks = combinedBits.match(/.{11}/g) ?? [];
  const mnemonic = entropyToMnemonic(entropy, wordlist);

  return {
    entropyHex,
    entropyBits,
    hashHex,
    checksumBits,
    combinedBits,
    chunks,
    words: mnemonic.split(" "),
    mnemonic,
  };
}

export function normalizeMnemonic(value: string) {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

export function buildMnemonicDetailsFromWords(value: string): MnemonicDetails {
  const mnemonic = normalizeMnemonic(value);
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("Invalid BIP39 mnemonic or checksum.");
  }
  return buildMnemonicDetails(bytesToHex(mnemonicToEntropy(mnemonic, wordlist)));
}

export function getLastWordCandidates(value: string): CompletionCandidates {
  const normalizedPartial = normalizeMnemonic(value);
  const words = normalizedPartial ? normalizedPartial.split(" ") : [];

  if (words.length !== 11 && words.length !== 23) {
    throw new Error(`Enter exactly 11 or 23 words. You currently have ${words.length}.`);
  }

  const invalidWord = words.find((word) => !bip39Words.has(word));
  if (invalidWord) {
    throw new Error(`“${invalidWord}” is not in the English BIP39 word list.`);
  }

  const candidates = wordlist.filter((lastWord) =>
    validateMnemonic(`${normalizedPartial} ${lastWord}`, wordlist),
  );
  const isTwelveWords = words.length === 11;

  return {
    normalizedPartial,
    wordCount: isTwelveWords ? 11 : 23,
    finalWordCount: isTwelveWords ? 12 : 24,
    missingEntropyBits: isTwelveWords ? 7 : 3,
    candidates,
  };
}

function secureRandomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error("Secure selection requires at least one choice.");
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generation is unavailable in this browser.");
  }

  const range = 0x1_0000_0000;
  const limit = range - (range % length);
  const random = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(random);
  } while (random[0] >= limit);

  return random[0] % length;
}

export function chooseSecureLastWord(candidates: string[]): string {
  if (candidates.length === 0) {
    throw new Error("No valid BIP39 final words were found.");
  }
  return candidates[secureRandomIndex(candidates.length)];
}

export function chooseSecureIndices(length: number, count: number): number[] {
  if (!Number.isSafeInteger(count) || count <= 0 || count > length) {
    throw new Error("The verification challenge size is invalid.");
  }

  const remaining = Array.from({ length }, (_, index) => index);
  const selected: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const choice = secureRandomIndex(remaining.length);
    selected.push(remaining.splice(choice, 1)[0]);
  }
  return selected.sort((a, b) => a - b);
}

export function deriveBip84Addresses(
  mnemonic: string,
  passphrase: string,
  count = 5,
): DerivedAddress[] {
  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  const root = HDKey.fromMasterSeed(seed);

  return Array.from({ length: count }, (_, index) => {
    const path = `m/84'/0'/0'/0/${index}`;
    const child = root.derive(path);
    const publicKey = child.publicKey;
    const privateKey = child.privateKey;
    if (!publicKey || !privateKey) throw new Error(`Could not derive key pair at ${path}`);
    const witnessProgram = ripemd160(sha256(publicKey));
    const privateKeyWif = base58check.encode(
      concatBytes(Uint8Array.of(0x80), privateKey, Uint8Array.of(0x01)),
    );
    const address = bech32.encode(
      "bc",
      [0, ...bech32.toWords(witnessProgram)],
      90,
    );
    return {
      index,
      path,
      publicKey: bytesToHex(publicKey),
      publicKeyHash: bytesToHex(witnessProgram),
      privateKey: bytesToHex(privateKey),
      scriptPubKey: `0014${bytesToHex(witnessProgram)}`,
      wif: privateKeyWif,
      address,
    };
  });
}

export function deriveWalletIdentity(
  mnemonic: string,
  passphrase: string,
): WalletIdentity {
  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  const root = HDKey.fromMasterSeed(seed);
  const bip84Root = HDKey.fromMasterSeed(seed, BIP84_VERSIONS);
  const accountPath = "m/84'/0'/0'";

  return {
    masterFingerprint: (root.fingerprint >>> 0).toString(16).padStart(8, "0"),
    accountPath,
    accountXpub: root.derive(accountPath).publicExtendedKey,
    accountZpub: bip84Root.derive(accountPath).publicExtendedKey,
  };
}

export function deriveSeedHex(mnemonic: string, passphrase: string) {
  return bytesToHex(mnemonicToSeedSync(mnemonic, passphrase));
}
