import {
  Binary,
  Camera,
  Check,
  ChevronRight,
  CircleDot,
  Clipboard,
  Coins,
  Copy,
  Dices,
  Eye,
  EyeOff,
  FileKey,
  Hash,
  KeyRound,
  Layers3,
  Moon,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Undo2,
} from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/ui/accordion";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Progress } from "./components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { BackupSheet } from "./components/backup-sheet";
import { CameraEntropyControls } from "./components/camera-entropy";
import { GlossaryTerm } from "./components/glossary-term";
import { PassphraseStrengthMeter } from "./components/passphrase-strength";
import { VerifyPanel, type VerifyKind } from "./components/verify-panel";
import {
  buildMnemonicDetails,
  buildMnemonicDetailsFromWords,
  chooseSecureLastWord,
  deriveBip84Addresses,
  deriveSeedHex,
  deriveWalletIdentity,
  getLastWordCandidates,
} from "./lib/crypto";
import {
  canonicalInput,
  extractorInput,
  formatCrackTime,
  generateSecureTranscript,
  parseEntropy,
  requiredEvents,
  sourceToEntropyHex,
  type EntropyMode,
} from "./lib/entropy";
import { cn, copyText, truncateMiddle } from "./lib/utils";
import { estimatePassphraseStrength } from "./lib/passphrase";
import { createSensitiveRevealState, sensitiveRevealReducer } from "./lib/sensitive-reveals";

const MODE_META = {
  coin: {
    label: "Coins",
    icon: Coins,
    placeholder: "Enter 0 for tails and 1 for heads…",
    hint: "Each fair flip contributes 1 bit.",
  },
  dice: {
    label: "Dice",
    icon: Dices,
    placeholder: "Enter rolls from 1 to 6…",
    hint: "Each independent fair roll contributes ≈2.585 bits.",
  },
  cards: {
    label: "Cards",
    icon: Layers3,
    placeholder: "Enter cards like AS KH 10D…",
    hint: "Draw from one thoroughly shuffled 52-card deck, without replacement.",
  },
  camera: {
    label: "Camera",
    icon: Camera,
    placeholder: "Camera capture digest appears here…",
    hint: "Sample motion and sensor variation from several live camera frames.",
  },
  hex: {
    label: "Hex",
    icon: Hash,
    placeholder: "Paste 32 or 64 hexadecimal characters…",
    hint: "For cross-checking entropy from another trusted tool.",
  },
} satisfies Record<
  EntropyMode,
  { label: string; icon: typeof Coins; placeholder: string; hint: string }
>;

const SUITS = [
  { code: "S", symbol: "♠", label: "Spades", red: false },
  { code: "H", symbol: "♥", label: "Hearts", red: true },
  { code: "D", symbol: "♦", label: "Diamonds", red: true },
  { code: "C", symbol: "♣", label: "Clubs", red: false },
] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function SectionLabel({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted">
      <span className="flex size-6 items-center justify-center rounded-full border border-line bg-surface font-mono text-[10px] text-accent">
        {number}
      </span>
      {children}
    </div>
  );
}

function CopyButton({
  value,
  id,
  copied,
  onCopy,
  label = "Copy",
}: {
  value: string;
  id: string;
  copied: string | null;
  onCopy: (value: string, id: string) => void;
  label?: string;
}) {
  return (
    <Button variant="quiet" size="sm" onClick={() => onCopy(value, id)}>
      {copied === id ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {copied === id ? "Copied" : label}
    </Button>
  );
}

function AddressDetailField({
  label,
  value,
  id,
  copied,
  onCopy,
  concealed = false,
}: {
  label: React.ReactNode;
  value: string;
  id: string;
  copied: string | null;
  onCopy: (value: string, id: string) => void;
  concealed?: boolean;
}) {
  return (
    <div className="grid gap-2 border-t border-line/70 py-3 first:border-t-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="min-w-0 break-all font-mono text-[11px] leading-5">
        {concealed ? "••••••••••••••••••••••••••••••••" : value}
      </dd>
      {!concealed && (
        <dd>
          <CopyButton value={value} id={id} copied={copied} onCopy={onCopy} />
        </dd>
      )}
    </div>
  );
}

function ColorizedAddress({ address }: { address: string }) {
  const chunks = address.match(/.{1,4}/g) ?? [address];

  return (
    <code className="block truncate font-mono text-sm font-semibold" title={address}>
      <span className="sr-only">{address}</span>
      <span aria-hidden="true">
        {chunks.map((chunk, index) => (
          <span key={`${index}-${chunk}`} className={index % 2 === 0 ? "text-ink" : "text-muted"}>
            {chunk}
          </span>
        ))}
      </span>
    </code>
  );
}

function EntropyControls({
  mode,
  raw,
  onChange,
}: {
  mode: EntropyMode;
  raw: string;
  onChange: (value: string) => void;
}) {
  const [selectedSuit, setSelectedSuit] = useState<(typeof SUITS)[number]["code"]>("S");
  const append = (value: string, separator = "") => onChange(`${raw}${separator}${value}`);
  const undo = () => {
    if (mode === "cards") {
      onChange(raw.trim().split(/[\s,]+/).slice(0, -1).join(" "));
      return;
    }
    onChange(raw.slice(0, -1));
  };

  if (mode === "camera") {
    return <CameraEntropyControls value={raw} onChange={onChange} />;
  }

  return (
    <>
      {mode === "coin" && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" className="h-16 justify-start px-4" onClick={() => append("0")}>
            <span className="flex size-9 items-center justify-center rounded-full bg-ink text-canvas">0</span>
            <span className="text-left"><span className="block">Tails</span><span className="block text-xs font-normal text-muted">record zero</span></span>
          </Button>
          <Button variant="outline" size="lg" className="h-16 justify-start px-4" onClick={() => append("1")}>
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-white">1</span>
            <span className="text-left"><span className="block">Heads</span><span className="block text-xs font-normal text-muted">record one</span></span>
          </Button>
        </div>
      )}

      {mode === "dice" && (
        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((roll) => (
            <Button key={roll} variant="outline" className="h-12 px-0 font-mono text-base" onClick={() => append(String(roll))}>
              {roll}
            </Button>
          ))}
        </div>
      )}

      {mode === "cards" && (
        <div className="space-y-3 rounded-xl border border-line bg-surface/55 p-3">
          <div className="grid grid-cols-4 gap-2">
            {SUITS.map((suit) => (
              <button
                key={suit.code}
                type="button"
                aria-label={suit.label}
                aria-pressed={selectedSuit === suit.code}
                onClick={() => setSelectedSuit(suit.code)}
                className={cn(
                  "h-10 rounded-lg border text-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  selectedSuit === suit.code ? "border-ink bg-ink text-canvas shadow-sm" : "border-line bg-surface hover:border-ink/25",
                  suit.red && selectedSuit !== suit.code && "text-danger",
                )}
              >
                {suit.symbol}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:[grid-template-columns:repeat(13,minmax(0,1fr))]">
            {RANKS.map((rank) => (
              <button
                key={rank}
                type="button"
                onClick={() => append(`${rank}${selectedSuit}`, raw.trim() ? " " : "")}
                className="h-9 rounded-lg border border-line bg-surface font-mono text-xs font-bold transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {rank}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <textarea
          value={raw}
          onChange={(event) => onChange(event.target.value)}
          placeholder={MODE_META[mode].placeholder}
          spellCheck={false}
          aria-label={`${MODE_META[mode].label} entropy transcript`}
          className="sensitive scrollbar-thin min-h-28 w-full resize-y rounded-xl border border-line bg-surface/70 px-4 py-3 pr-12 font-mono text-sm leading-6 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-2 right-2 size-8"
          aria-label="Undo last entry"
          disabled={!raw}
          onClick={undo}
        >
          <Undo2 className="size-4" />
        </Button>
      </div>
    </>
  );
}

function BitStream({
  bits,
  checksumLength,
  activeChunk,
}: {
  bits: string;
  checksumLength: number;
  activeChunk: number | null;
}) {
  const entropyLength = bits.length - checksumLength;
  const chunks = bits.match(/.{1,11}/g) ?? [];

  return (
    <div className="break-all rounded-xl border border-line bg-ink px-4 py-3 font-mono text-[11px] leading-5 text-canvas/70">
      {chunks.map((chunk, chunkIndex) => (
        <span
          key={chunkIndex}
          className={cn(
            "rounded-sm transition-colors duration-150",
            activeChunk === chunkIndex && "bg-success/30 text-canvas ring-1 ring-success/60",
          )}
        >
          {[...chunk].map((bit, bitIndex) => {
            const absoluteIndex = chunkIndex * 11 + bitIndex;
            const isChecksum = absoluteIndex >= entropyLength;
            return (
              <span key={bitIndex} className={isChecksum ? "bg-accent px-px font-bold text-white" : undefined} title={isChecksum ? "Checksum bit" : undefined}>
                {bit}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

function App() {
  const [workflow, setWorkflow] = useState<"create" | "verify">("create");
  const [mode, setMode] = useState<EntropyMode>("coin");
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [inputs, setInputs] = useState<Record<EntropyMode, string>>({ coin: "", dice: "", cards: "", camera: "", hex: "" });
  const [verifyKind, setVerifyKind] = useState<VerifyKind>("hex");
  const [verifyInput, setVerifyInput] = useState("");
  const [completedMnemonic, setCompletedMnemonic] = useState("");
  const [completionRandomError, setCompletionRandomError] = useState<string | null>(null);
  const [expectedAddress, setExpectedAddress] = useState("");
  const [expectedPublicKey, setExpectedPublicKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirmation, setPassphraseConfirmation] = useState("");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [{ showPassphrase, showSeed, privateKeyIds: revealedPrivateKeys }, dispatchSensitiveReveal] = useReducer(
    sensitiveRevealReducer,
    undefined,
    createSensitiveRevealState,
  );
  const [activeBitChunk, setActiveBitChunk] = useState<number | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const targetBits = wordCount === 12 ? 128 : 256;
  const raw = inputs[mode];
  const parsed = useMemo(() => parseEntropy(mode, raw), [mode, raw]);
  const entropyHex = useMemo(
    () => sourceToEntropyHex(mode, parsed, targetBits),
    [mode, parsed, targetBits],
  );
  const generatedDetails = useMemo(
    () => (entropyHex ? buildMnemonicDetails(entropyHex) : null),
    [entropyHex],
  );
  const completion = useMemo(() => {
    if (verifyKind !== "complete" || !verifyInput.trim()) return { data: null, error: null };
    try {
      return { data: getLastWordCandidates(verifyInput), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : "Invalid partial BIP39 mnemonic." };
    }
  }, [verifyInput, verifyKind]);
  const verification = useMemo(() => {
    if (!verifyInput.trim()) return { details: null, error: null };
    try {
      if (verifyKind === "complete") {
        if (!completedMnemonic) {
          return { details: null, error: completion.error ?? completionRandomError };
        }
        return { details: buildMnemonicDetailsFromWords(completedMnemonic), error: null };
      }
      if (verifyKind === "mnemonic") {
        const words = verifyInput.trim().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) {
          return { details: null, error: `Enter 12 or 24 words. You currently have ${words.length}.` };
        }
        return { details: buildMnemonicDetailsFromWords(verifyInput), error: null };
      }
      const normalized = verifyInput.toLowerCase().replace(/\s+/g, "");
      if (/[^0-9a-f]/.test(normalized)) {
        return { details: null, error: "Hex entropy can contain only 0–9 and A–F." };
      }
      if (normalized.length !== 32 && normalized.length !== 64) {
        return { details: null, error: `Enter exactly 32 characters for 12 words or 64 for 24 words. You currently have ${normalized.length}.` };
      }
      return { details: buildMnemonicDetails(normalized), error: null };
    } catch (error) {
      return { details: null, error: error instanceof Error ? error.message : "Invalid BIP39 input." };
    }
  }, [completedMnemonic, completion.error, completionRandomError, verifyInput, verifyKind]);
  const details = workflow === "create" ? generatedDetails : verification.details;
  const passphraseMatches = passphrase === passphraseConfirmation;
  const passphraseStrength = useMemo(() => estimatePassphraseStrength(passphrase), [passphrase]);
  const addresses = useMemo(
    () => (details && passphraseMatches ? deriveBip84Addresses(details.mnemonic, passphrase) : []),
    [details, passphrase, passphraseMatches],
  );
  const seedHex = useMemo(
    () => (details && passphraseMatches ? deriveSeedHex(details.mnemonic, passphrase) : ""),
    [details, passphrase, passphraseMatches],
  );
  const walletIdentity = useMemo(
    () => (details && passphraseMatches ? deriveWalletIdentity(details.mnemonic, passphrase) : null),
    [details, passphrase, passphraseMatches],
  );
  const needed = requiredEvents(mode, targetBits);
  const effectiveBits = Math.min(parsed.estimatedBits, targetBits);
  const sourceReady = parsed.estimatedBits >= targetBits && Boolean(generatedDetails);
  const ready = workflow === "create" ? sourceReady : Boolean(verification.details);
  const progress = (effectiveBits / targetBits) * 100;
  const hasExtraEntropy = mode !== "camera" && parsed.estimatedBits > targetBits;
  const hexIsCondensed = mode === "hex" && hasExtraEntropy;
  const hasIncompleteHexByte = hexIsCondensed && parsed.normalized.length % 2 !== 0;

  const handleCopy = async (value: string, id: string) => {
    await copyText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1_600);
  };

  const concealSensitiveReveals = () => dispatchSensitiveReveal({ type: "conceal-all" });

  const updateRaw = (value: string) => {
    setInputs((current) => ({ ...current, [mode]: value }));
    concealSensitiveReveals();
  };

  const generateAutomaticEntropy = () => {
    try {
      const generated = generateSecureTranscript(mode, targetBits);
      setInputs((current) => ({ ...current, [mode]: generated }));
      concealSensitiveReveals();
      setRandomError(null);
    } catch (error) {
      setRandomError(error instanceof Error ? error.message : "Secure random generation failed.");
    }
  };

  const completePhraseSecurely = () => {
    if (!completion.data) return;
    try {
      const lastWord = chooseSecureLastWord(completion.data.candidates);
      setCompletedMnemonic(`${completion.data.normalizedPartial} ${lastWord}`);
      concealSensitiveReveals();
      setCompletionRandomError(null);
    } catch (error) {
      setCompletedMnemonic("");
      concealSensitiveReveals();
      setCompletionRandomError(error instanceof Error ? error.message : "Secure final-word generation failed.");
    }
  };

  const toggleDarkMode = () => {
    setDarkMode((current) => {
      const next = !current;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  const togglePrivateKey = (keyId: string) => {
    dispatchSensitiveReveal({ type: "toggle-private-key", keyId });
  };

  const togglePrivacyMode = () => {
    setPrivacyMode((value) => !value);
    concealSensitiveReveals();
  };

  const eventUnit = mode === "camera" ? "capture" : mode === "hex" ? "characters" : mode === "cards" ? "unique cards" : mode === "coin" ? "flips" : "rolls";
  const remaining = needed === null ? null : Math.max(0, needed - parsed.events.length);
  const transcriptCopyLabel = mode === "dice"
    ? "Copy dice rolls"
    : mode === "coin"
      ? "Copy coin flips"
      : mode === "cards"
        ? "Copy card transcript"
        : mode === "camera"
          ? "Copy capture digest"
          : "Copy Hex input";
  const automaticGenerationSummary = mode === "coin"
    ? `${targetBits} simulated fair coin flips · CSPRNG`
    : mode === "dice"
      ? `${needed} simulated fair dice rolls · CSPRNG`
      : mode === "cards"
        ? needed === null
          ? "One complete 52-card shuffle · maximum ≈225.6 bits"
          : `${needed} cards drawn from one secure shuffle`
        : mode === "camera"
          ? "Live camera frames · locally hashed"
          : `${targetBits} cryptographically secure random bits`;

  if (showBackup && details && passphraseMatches) {
    return (
      <BackupSheet
        details={details}
        firstAddress={addresses[0]}
        hasPassphrase={Boolean(passphrase)}
        onBack={() => {
          setShowBackup(false);
          concealSensitiveReveals();
        }}
      />
    );
  }

  return (
    <div className={cn("min-h-screen", privacyMode && "privacy-mode")}>
      <header className="border-b border-line/80 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="Entropy home">
            <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-canvas shadow-sm">
              <Sparkles className="size-4" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">Entropy</span>
          </a>
          <div className="flex items-center gap-2">
            <Button
              variant="quiet"
              size="sm"
              onClick={toggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              <span className="hidden md:inline">{darkMode ? "Light" : "Dark"}</span>
            </Button>
            <Button variant="quiet" size="sm" onClick={togglePrivacyMode}>
              {privacyMode ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {privacyMode ? "Show private data" : "Presentation mode"}
            </Button>
            <div className="hidden items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success sm:flex">
              <CircleDot className="size-3 animate-pulse" />
              100% offline
            </div>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1440px] px-4 pb-16 pt-10 sm:px-6 lg:px-10 lg:pt-14">
        <section className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end">
          <div>
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">
              <span className="h-px w-8 bg-accent" />
              From chance to keys
            </p>
            <h1 className="max-w-4xl text-balance font-display text-[clamp(2.6rem,7vw,6.4rem)] font-medium leading-[0.92] tracking-[-0.045em]">
              See randomness become a Bitcoin wallet.
            </h1>
          </div>
          <div className="border-l-2 border-accent pl-5 text-sm leading-6 text-muted lg:mb-2">
            Flip, roll, draw, or sample a camera in the physical world. This workbench makes every deterministic step afterward visible — and keeps all data on this device.
          </div>
        </section>

        <div className="mb-6 flex justify-center">
          <div className="grid w-full max-w-xl grid-cols-2 rounded-2xl border border-line bg-surface p-1.5 shadow-soft">
            <button
              type="button"
              onClick={() => {
                setWorkflow("create");
                concealSensitiveReveals();
              }}
              className={cn("rounded-xl px-4 py-3 text-sm font-semibold transition", workflow === "create" ? "bg-ink text-canvas shadow-sm" : "text-muted hover:text-ink")}
            >
              Create from randomness
            </button>
            <button
              type="button"
              onClick={() => {
                setWorkflow("verify");
                concealSensitiveReveals();
              }}
              className={cn("rounded-xl px-4 py-3 text-sm font-semibold transition", workflow === "verify" ? "bg-ink text-canvas shadow-sm" : "text-muted hover:text-ink")}
            >
              Verify an existing result
            </button>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[27rem_minmax(0,1fr)]">
          <Card className="p-4 shadow-soft sm:p-5 xl:sticky xl:top-5">
            <SectionLabel number="01">{workflow === "create" ? "Record chance" : "Verify a result"}</SectionLabel>

            {workflow === "create" ? (
              <>

            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/55 p-1.5">
              <span className="pl-2 text-xs font-semibold text-muted">Seed length</span>
              <div className="flex gap-1">
                {[12, 24].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      setWordCount(count as 12 | 24);
                      concealSensitiveReveals();
                    }}
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      wordCount === count ? "bg-ink text-canvas shadow-sm" : "text-muted hover:text-ink",
                    )}
                  >
                    {count} words
                  </button>
                ))}
              </div>
            </div>

            <Tabs
              value={mode}
              onValueChange={(value) => {
                setMode(value as EntropyMode);
                concealSensitiveReveals();
              }}
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-5">
                {(Object.keys(MODE_META) as EntropyMode[]).map((key) => {
                  const Icon = MODE_META[key].icon;
                  return (
                    <TabsTrigger key={key} value={key} aria-label={MODE_META[key].label} className="px-1 sm:px-2">
                      <Icon className="size-4" />
                      <span className="hidden sm:inline">{MODE_META[key].label}</span>
                      {inputs[key] && <span className="size-1.5 rounded-full bg-success" aria-label="Saved transcript" />}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {mode !== "camera" && (
                <div>
                  <Button variant="accent" className="mb-2 w-full" onClick={generateAutomaticEntropy}>
                    <Sparkles className="size-4" /> Generate {MODE_META[mode].label.toLowerCase()} automatically
                  </Button>
                  <p className="text-center text-[10px] leading-4 text-muted">
                    {automaticGenerationSummary} · generated entirely offline
                  </p>
                  <p className="mt-1 text-center text-[10px] leading-4 text-muted">
                    Each source tab keeps its own transcript.
                  </p>
                </div>
              )}
              {randomError && <p className="rounded-lg bg-danger/[0.06] px-3 py-2 text-xs text-danger">{randomError}</p>}

              <div className="space-y-3">
                <p className="min-h-5 text-xs leading-5 text-muted">{MODE_META[mode].hint}</p>
                <EntropyControls mode={mode} raw={raw} onChange={updateRaw} />
                <div className="flex items-center justify-between gap-3 px-1">
                  <span className="text-[10px] leading-4 text-muted">
                    {mode === "camera"
                      ? "Copies the capture digest, never a photo or raw frame."
                      : "Copies the recorded source transcript, not the final BIP39 entropy."}
                  </span>
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={!parsed.normalized}
                    onClick={() => handleCopy(parsed.normalized, "source-transcript")}
                  >
                    {copied === "source-transcript" ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Clipboard className="size-3.5" />
                    )}
                    {copied === "source-transcript" ? "Copied" : transcriptCopyLabel}
                  </Button>
                </div>
                <div className={cn(
                  "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] leading-5",
                  mode === "dice" ? "border-success/20 bg-success/[0.055] text-success" : "border-line bg-surface/45 text-muted",
                )}>
                  {mode === "dice" ? <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> : <Binary className="mt-0.5 size-3.5 shrink-0" />}
                  <span>
                    <strong className="font-semibold text-ink">Conversion method:</strong>{" "}
                    {mode === "dice"
                      ? "Ian Coleman compatible · Dice → base 6 → SHA-256"
                      : mode === "camera"
                        ? "24 downsampled RGBA frames + monotonic timing → SHA-256 capture digest → domain-separated SHA-256"
                      : mode === "hex"
                        ? "Exact BIP39 Hex · oversized input is condensed with SHA-256"
                        : "Entropy Workbench v1 · source-separated SHA-256"}
                  </span>
                </div>
              </div>
            </Tabs>

            {(parsed.invalidCount > 0 || parsed.duplicateCount > 0) && (
              <div className="mt-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-xs leading-5 text-danger">
                {parsed.invalidCount > 0 && `${parsed.invalidCount} invalid ${parsed.invalidCount === 1 ? "entry was" : "entries were"} ignored. `}
                {parsed.duplicateCount > 0 && `${parsed.duplicateCount} duplicate ${parsed.duplicateCount === 1 ? "card was" : "cards were"} ignored.`}
              </div>
            )}

            <div className="mt-5 rounded-xl border border-line bg-surface/55 p-4">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  {mode === "camera" ? (
                    <>
                      <div className="text-xs font-semibold text-muted">Camera capture</div>
                      <div className="mt-1 font-mono text-xl font-semibold">{sourceReady ? "Digest ready" : "Not captured"}</div>
                      <div className="mt-1 text-[10px] font-semibold text-muted">Sensor entropy is not quantifiable</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-muted"><GlossaryTerm definition="A measure of unpredictability, expressed in bits. More genuinely random independent events make guessing the original source exponentially harder.">Estimated source entropy</GlossaryTerm></div>
                      <div className="mt-1 font-mono text-xl font-semibold">
                        {(hasExtraEntropy ? parsed.estimatedBits : effectiveBits).toFixed(effectiveBits < 10 ? 1 : 0)}
                        <span className="ml-1 text-xs font-normal text-muted">
                          {hasExtraEntropy ? "input bits" : `/ ${targetBits} bits`}
                        </span>
                      </div>
                      {hasExtraEntropy && (
                        <div className="mt-1 font-mono text-[10px] font-semibold text-success">→ {targetBits} BIP39 bits</div>
                      )}
                    </>
                  )}
                </div>
                <div className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", sourceReady ? "bg-success/10 text-success" : "bg-accent/10 text-accent")}>
                  {sourceReady ? "READY" : "COLLECTING"}
                </div>
              </div>
              <Progress value={progress} className={sourceReady ? "[&>div]:bg-success" : undefined} />
              <p className="mt-3 text-xs leading-5 text-muted">
                {sourceReady
                  ? mode === "camera"
                    ? `24 camera frames were hashed locally into a 256-bit capture digest, then converted to ${targetBits} BIP39 bits. This does not prove ${targetBits} bits of real-world entropy.`
                    : hexIsCondensed
                    ? `${parsed.estimatedBits} input bits condensed with SHA-256 to ${targetBits} BIP39 bits. Every complete byte is included.`
                    : `${parsed.events.length} ${eventUnit} recorded. You have reached the ${targetBits}-bit target.`
                  : remaining === null
                    ? `One shuffled deck tops out at ≈225.6 bits. Use 12 words, coins, or dice for a complete target.`
                    : hasIncompleteHexByte
                      ? "Add one hexadecimal character to complete the final byte."
                    : mode === "camera"
                      ? "Start the camera and complete one capture. No frame leaves the browser or remains in the transcript."
                      : `${remaining} more ${eventUnit} to reach the conservative target.`}
              </p>
            </div>

            {mode !== "camera" && (
              <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted">
                <span>At 1 trillion guesses/sec</span>
                <span className="font-mono font-semibold text-ink">{formatCrackTime(effectiveBits)}</span>
              </div>
            )}

            {generatedDetails && (
              <Accordion type="single" collapsible className="mt-4 rounded-xl border border-success/20 bg-success/[0.055] px-4">
                <AccordionItem value="ian-verification" className="border-0">
                  <AccordionTrigger className="py-3.5 text-xs text-success hover:text-success">
                    <span className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4" /> Verify with Ian Coleman</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pb-1 text-[11px] leading-5 text-muted">
                      {mode === "dice" && (
                        <div>
                          <div className="font-bold text-ink">Compare the same dice rolls</div>
                          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                            <li>Select <strong className="text-ink">Dice [1–6]</strong>.</li>
                            <li>Select <strong className="text-ink">{wordCount} words</strong>, not “Use Raw Entropy”.</li>
                            <li>Paste the exact dice transcript below.</li>
                          </ol>
                          <div className="mt-2">
                            <CopyButton value={parsed.normalized} id="ian-dice-transcript" copied={copied} onCopy={handleCopy} label="Copy dice rolls" />
                          </div>
                        </div>
                      )}
                      <div className={cn(mode === "dice" && "border-t border-line/70 pt-4")}>
                        <div className="font-bold text-ink">Compare the final BIP39 entropy</div>
                        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                          <li>Select <strong className="text-ink">Hex [0–9A–F]</strong>.</li>
                          <li>Select <strong className="text-ink">Use Raw Entropy</strong>.</li>
                          <li>Paste the final hexadecimal value below.</li>
                        </ol>
                        <div className="mt-2">
                          <CopyButton value={generatedDetails.entropyHex} id="ian-bip39-entropy" copied={copied} onCopy={handleCopy} label="Copy BIP39 entropy (Hex)" />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <Button variant="ghost" size="sm" className="mt-4 w-full text-muted" disabled={!raw} onClick={() => updateRaw("")}>
              <RotateCcw className="size-3.5" /> {mode === "camera" ? "Clear capture digest" : "Clear this transcript"}
            </Button>
              </>
            ) : (
              <VerifyPanel
                kind={verifyKind}
                onKindChange={(kind) => {
                  setVerifyKind(kind);
                  setVerifyInput("");
                  setCompletedMnemonic("");
                  concealSensitiveReveals();
                  setCompletionRandomError(null);
                  setExpectedAddress("");
                  setExpectedPublicKey("");
                }}
                input={verifyInput}
                onInputChange={(value) => {
                  setVerifyInput(value);
                  setCompletedMnemonic("");
                  concealSensitiveReveals();
                  setCompletionRandomError(null);
                }}
                error={verification.error}
                details={verification.details}
                expectedAddress={expectedAddress}
                onExpectedAddressChange={setExpectedAddress}
                expectedPublicKey={expectedPublicKey}
                onExpectedPublicKeyChange={setExpectedPublicKey}
                actualAddress={addresses[0]?.address ?? ""}
                actualPublicKey={addresses[0]?.publicKey ?? ""}
                completionCandidateCount={completion.data?.candidates.length ?? 0}
                completionMissingBits={completion.data?.missingEntropyBits ?? null}
                completedMnemonic={completedMnemonic}
                onCompletePhrase={completePhraseSecurely}
              />
            )}
          </Card>

          <div className="space-y-5">
            <Card className="overflow-hidden shadow-soft">
              <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <SectionLabel number="02">{workflow === "create" ? "Build the mnemonic" : "Validate the mnemonic"}</SectionLabel>
                  <h2 className="font-display text-2xl font-semibold">
                    {workflow === "create" ? "Your " : "Verified "}<GlossaryTerm definition="BIP39 converts entropy plus a checksum into a standardized list of recovery words. The words represent the wallet secret; they are not a password chosen by a person.">BIP39 words</GlossaryTerm>
                  </h2>
                </div>
                {details && (
                  <div className="flex flex-wrap items-center gap-2">
                    {!ready && <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-accent">LIVE PREVIEW</span>}
                    <CopyButton value={details.mnemonic} id="mnemonic" copied={copied} onCopy={handleCopy} label="Copy words" />
                    {ready && <Button variant="accent" size="sm" disabled={!passphraseMatches || privacyMode} title={privacyMode ? "Leave presentation mode to open the backup sheet" : undefined} onClick={() => {
                      concealSensitiveReveals();
                      setShowBackup(true);
                    }}><FileKey className="size-3.5" /> Backup sheet</Button>}
                  </div>
                )}
              </div>

              <div className="p-5 sm:p-6">
                {details ? (
                  <>
                    {!ready && (
                      <div className="mb-5 flex gap-3 rounded-xl border border-accent/20 bg-accent/[0.055] p-3 text-xs leading-5 text-ink/75">
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
                        These words are a live preview. Every new event changes them, but the source is not strong enough yet for a real wallet.
                      </div>
                    )}
                    <ol className={cn("sensitive grid gap-2", details.words.length === 24 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3") }>
                      {details.words.map((word, index) => (
                        <li
                          key={`${index}-${word}`}
                          className="animate-word-in flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-3"
                          style={{ animationDelay: `${Math.min(index * 18, 180)}ms` }}
                        >
                          <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 truncate font-mono text-sm font-semibold">{word}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/35 px-6 text-center">
                    <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-ink/[0.06] text-muted">
                      <Binary className="size-5" />
                    </div>
                    <h3 className="font-display text-xl font-semibold">{workflow === "create" ? "Waiting for randomness" : "Waiting for a valid result"}</h3>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                      {workflow === "create" ? "Add your first physical event. The words will update as the transcript grows." : "Paste exact BIP39 entropy, a complete mnemonic, or the first 11/23 words in the verification panel."}
                    </p>
                  </div>
                )}
              </div>

              {details && (
                <div className="border-t border-line bg-surface/25 px-5 sm:px-6">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="details" className="border-0">
                      <AccordionTrigger>
                        <span className="flex items-center gap-2"><Binary className="size-4 text-accent" /> Show entropy details</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-5">
                          <div className="grid gap-4 md:grid-cols-[9rem_1fr]">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-accent">Step A</div>
                              <div className="mt-1 font-semibold">Normalize</div>
                            </div>
                            <div className="min-w-0">
                              <p className="mb-2 text-xs leading-5 text-muted">
                                {workflow === "verify"
                                  ? verifyKind === "hex"
                                    ? "Whitespace and capitalization are normalized; the exact Hex value is validated."
                                    : verifyKind === "complete"
                                      ? "The partial phrase is normalized and every supplied word is checked against the English BIP39 list."
                                      : "Spaces and capitalization are normalized before the BIP39 checksum is validated."
                                  : mode === "camera"
                                    ? "Each downsampled camera frame is mixed with its monotonic capture time and hashed immediately. The raw pixels are then cleared; only the final capture digest is retained."
                                  : mode === "hex"
                                    ? hexIsCondensed
                                      ? "The hexadecimal input is normalized and decoded as raw bytes."
                                      : "Exact-length Hex input is used directly as BIP39 entropy."
                                    : mode === "dice"
                                      ? "Dice faces are normalized. For Ian Coleman compatibility, face 6 becomes the base-6 digit 0 before hashing."
                                      : "The source type and transcript are made explicit so the same input always hashes identically."}
                              </p>
                              <div className="sensitive whitespace-pre-wrap overflow-x-auto rounded-lg bg-ink/[0.055] p-3 font-mono text-[11px] leading-5">
                                {workflow === "verify"
                                  ? verifyKind === "hex"
                                    ? verifyInput.toLowerCase().replace(/\s+/g, "")
                                    : details.mnemonic
                                  : mode === "hex"
                                    ? parsed.normalized
                                  : mode === "dice"
                                      ? `Dice transcript: ${parsed.normalized}\nExtractor input: ${extractorInput(mode, parsed.normalized)}`
                                    : mode === "camera"
                                      ? `Capture digest: ${parsed.normalized}\nExtractor input: ${canonicalInput(mode, parsed.normalized)}`
                                      : canonicalInput(mode, parsed.normalized)}
                              </div>
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-[9rem_1fr]">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-accent">Step B</div>
                              <div className="mt-1 font-semibold">Extract</div>
                            </div>
                            <div className="min-w-0">
                              <p className="mb-2 text-xs leading-5 text-muted">
                                {workflow === "verify"
                                  ? verifyKind === "hex"
                                    ? "Verification uses this exact value directly; no extractor or transformation is applied."
                                    : verifyKind === "complete"
                                      ? "A cryptographically secure random choice supplies the remaining entropy bits. BIP39 then derives the checksum portion of the final word, and the original entropy is recovered from the completed phrase."
                                      : "The original BIP39 entropy is recovered from the validated word indexes and checksum."
                                  : mode === "camera"
                                    ? `A domain-separated SHA-256 hashes the 256-bit capture digest; the first ${targetBits} bits become the BIP39 entropy. The digest size is not an estimate of camera unpredictability.`
                                  : mode === "hex"
                                    ? hexIsCondensed
                                      ? `SHA-256 condenses all ${parsed.estimatedBits} input bits; the first ${targetBits} bits become the BIP39 entropy.`
                                      : "No extractor is applied when Hex input has the exact BIP39 length."
                                    : mode === "dice"
                                      ? `SHA-256 hashes the Ian Coleman-compatible base-6 transcript; the first ${targetBits} bits become the BIP39 entropy.`
                                      : `SHA-256 produces a stable 256-bit digest; the first ${targetBits} bits become the BIP39 entropy.`}
                              </p>
                              <div className="sensitive flex items-center justify-between gap-3 rounded-lg bg-ink/[0.055] p-3">
                                <code className="min-w-0 break-all text-[11px]">{details.entropyHex}</code>
                                <CopyButton value={details.entropyHex} id="entropy" copied={copied} onCopy={handleCopy} label="Copy BIP39 entropy" />
                              </div>
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-[9rem_1fr]">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-accent">Step C</div>
                              <div className="mt-1 font-semibold"><GlossaryTerm definition="A small set of bits derived from SHA-256 that lets wallets detect many typing errors. It checks structure, not whether a wallet is the one you intended.">Add checksum</GlossaryTerm></div>
                            </div>
                            <div>
                              <p className="mb-2 text-xs leading-5 text-muted">
                                SHA-256(entropy) starts with <strong className="font-mono text-accent">{details.checksumBits}</strong>. BIP39 appends those {details.checksumBits.length} bits, then splits the result into 11-bit indexes.
                              </p>
                              <BitStream bits={details.combinedBits} checksumLength={details.checksumBits.length} activeChunk={activeBitChunk} />
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {details.chunks.map((chunk, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onMouseEnter={() => setActiveBitChunk(index)}
                                    onMouseLeave={() => setActiveBitChunk(null)}
                                    onFocus={() => setActiveBitChunk(index)}
                                    onBlur={() => setActiveBitChunk(null)}
                                    className={cn(
                                      "rounded-md border border-line bg-surface px-2 py-1 font-mono text-[10px] outline-none transition",
                                      activeBitChunk === index && "border-success bg-success/10 text-success ring-2 ring-success/20",
                                    )}
                                    title={`Word ${index + 1} (${details.words[index]}): index ${Number.parseInt(chunk, 2)}`}
                                    aria-label={`Highlight bits for word ${index + 1}, ${details.words[index]}`}
                                  >
                                    {chunk}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
            </Card>

            <Card className="p-5 shadow-soft sm:p-6">
              <SectionLabel number="03">Stretch into a seed</SectionLabel>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    Optional <GlossaryTerm definition="An extra secret added to the mnemonic. Every exact passphrase creates a different valid wallet, so there is no ‘wrong passphrase’ error.">passphrase</GlossaryTerm>
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                    BIP39 runs PBKDF2-HMAC-SHA512 for 2,048 rounds. Every passphrase creates a valid, completely different wallet.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-muted">
                      Passphrase
                      <input
                        type={showPassphrase ? "text" : "password"}
                        value={passphrase}
                        onChange={(event) => {
                          setPassphrase(event.target.value);
                          concealSensitiveReveals();
                        }}
                        disabled={!details}
                        autoComplete="off"
                        placeholder={details ? "Leave empty for no passphrase" : "Add a valid input first"}
                        aria-label="Optional BIP39 passphrase"
                        className="sensitive mt-1.5 h-12 w-full rounded-xl border border-line bg-surface/70 px-4 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:opacity-50"
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      Confirm passphrase
                      <input
                        type={showPassphrase ? "text" : "password"}
                        value={passphraseConfirmation}
                        onChange={(event) => {
                          setPassphraseConfirmation(event.target.value);
                          concealSensitiveReveals();
                        }}
                        disabled={!details}
                        autoComplete="off"
                        placeholder={details ? "Type it again exactly" : "Add a valid input first"}
                        aria-label="Confirm BIP39 passphrase"
                        className="sensitive mt-1.5 h-12 w-full rounded-xl border border-line bg-surface/70 px-4 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:opacity-50"
                      />
                    </label>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2" disabled={!details} onClick={() => dispatchSensitiveReveal({ type: "toggle-passphrase" })}>
                    {showPassphrase ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {showPassphrase ? "Hide passphrase" : "Show passphrase"}
                  </Button>
                  {details && <PassphraseStrengthMeter strength={passphraseStrength} />}
                </div>
                <div className="rounded-xl border border-line bg-surface/55 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted"><KeyRound className="size-3.5 text-accent" /> <GlossaryTerm definition="The 512-bit value created from the mnemonic and passphrase. BIP32 uses it to deterministically derive the wallet's keys.">512-bit seed</GlossaryTerm></div>
                  <div className="sensitive mt-3 min-h-10 break-all font-mono text-[10px] leading-5 text-ink/75">
                    {seedHex ? (showSeed ? seedHex : `${seedHex.slice(0, 16)}${"•".repeat(20)}${seedHex.slice(-8)}`) : "—"}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2 w-full" disabled={!seedHex} onClick={() => dispatchSensitiveReveal({ type: "toggle-seed" })}>
                    {showSeed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {showSeed ? "Hide seed" : "Reveal seed"}
                  </Button>
                </div>
              </div>
              {!passphraseMatches && (
                <div className="mt-4 rounded-xl border border-danger/25 bg-danger/[0.055] px-4 py-3 text-xs leading-5 text-danger">
                  Passphrases do not match. Seed, wallet identity, addresses, and backup are paused until both fields are identical.
                </div>
              )}
              {passphraseMatches && passphrase && (
                <div className="mt-4 rounded-xl border border-success/20 bg-success/[0.055] px-4 py-3 text-xs leading-5 text-success">
                  Passphrases match. Record it exactly and store it separately — a typo creates another valid wallet.
                </div>
              )}
            </Card>

            <Card className="overflow-hidden shadow-soft">
              <div className="border-b border-line p-5 sm:p-6">
                <SectionLabel number="04">Derive addresses</SectionLabel>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-semibold"><GlossaryTerm definition="BIP84 defines Native SegWit P2WPKH accounts whose Bitcoin mainnet addresses begin with bc1q.">Native SegWit · BIP84</GlossaryTerm></h2>
                    <p className="mt-2 text-sm text-muted">Mainnet receiving <GlossaryTerm definition="A derivation path is an address inside the deterministic key tree. The same seed, passphrase, network, and path always produce the same key.">path</GlossaryTerm> <code className="rounded bg-ink/[0.055] px-1.5 py-1 font-mono text-xs text-ink">m/84'/0'/0'/0/i</code></p>
                  </div>
                  {ready && (
                    <span className="flex w-fit items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success">
                      <ShieldCheck className="size-3.5" /> {workflow === "create" ? "Target reached" : "Valid result"}
                    </span>
                  )}
                </div>
              </div>

              {walletIdentity && (
                <Accordion type="single" collapsible className="sensitive border-b border-line">
                  <AccordionItem value="wallet-identity" className="border-0">
                    <AccordionTrigger className="px-5 py-5 hover:bg-ink/[0.035] hover:text-ink sm:px-6">
                      <span className="flex min-w-0 flex-1 flex-col gap-3 pr-3 text-left sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <span className="block font-display text-xl font-semibold">Public wallet identity</span>
                          <span className="mt-1 block max-w-2xl text-xs font-normal leading-5 text-muted">Fingerprint, account path, XPUB and ZPUB</span>
                        </span>
                        <span className="w-fit rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">PUBLIC · PRIVACY-SENSITIVE</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 sm:px-6">
                      <p className="mb-4 max-w-2xl text-xs leading-5 text-muted">
                        Use these values to identify or import this BIP84 account as watch-only. They cannot spend bitcoin, but they can reveal every address and balance in the account.
                      </p>
                      <dl className="rounded-xl border border-line bg-ink/[0.025] px-4">
                        <AddressDetailField
                          label={<GlossaryTerm definition="The first four bytes of the master public-key hash. Wallet coordinators use it as a short identifier for the signing device or seed.">Master fingerprint</GlossaryTerm>}
                          value={walletIdentity.masterFingerprint}
                          id="master-fingerprint"
                          copied={copied}
                          onCopy={handleCopy}
                        />
                        <AddressDetailField label="Account path" value={walletIdentity.accountPath} id="account-path" copied={copied} onCopy={handleCopy} />
                        <AddressDetailField
                          label={<GlossaryTerm definition="An extended public key for the BIP84 account. It derives all receiving and change addresses without exposing private keys.">Account XPUB</GlossaryTerm>}
                          value={walletIdentity.accountXpub}
                          id="account-xpub"
                          copied={copied}
                          onCopy={handleCopy}
                        />
                        <AddressDetailField
                          label={<GlossaryTerm definition="The same account public key serialized with BIP84 version bytes. Compatible tools display this Native SegWit form with a zpub prefix.">BIP84 ZPUB</GlossaryTerm>}
                          value={walletIdentity.accountZpub}
                          id="account-zpub"
                          copied={copied}
                          onCopy={handleCopy}
                        />
                      </dl>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {addresses.length > 0 ? (
                <Accordion
                  type="single"
                  collapsible
                  className="sensitive"
                  onValueChange={() => dispatchSensitiveReveal({ type: "clear-private-keys" })}
                >
                  {addresses.map((item) => (
                    <AccordionItem key={item.path} value={item.path} className="first:border-t-0">
                      <AccordionTrigger className="px-4 py-4 hover:bg-ink/[0.035] hover:text-ink sm:px-6">
                        <span className="grid min-w-0 flex-1 grid-cols-[2.2rem_minmax(0,1fr)] items-center gap-3 pr-3 sm:grid-cols-[2.2rem_minmax(0,1fr)_auto]">
                          <span className="flex size-9 items-center justify-center rounded-xl bg-ink/[0.055] font-mono text-xs font-bold">{item.index}</span>
                          <span className="min-w-0">
                            <ColorizedAddress address={item.address} />
                            <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-normal text-muted">
                              <span className="font-mono">{item.path}</span><span>·</span>
                              <span className="font-mono" title={item.publicKey}>pub {truncateMiddle(item.publicKey, 14, 10)}</span>
                            </span>
                          </span>
                          <span className="hidden rounded-full border border-line px-2.5 py-1 text-[10px] font-bold text-muted sm:block">P2WPKH</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 sm:px-6">
                        <div className="rounded-xl border border-line bg-ink/[0.025] p-4">
                          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-danger/25 bg-danger/[0.055] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex gap-2.5">
                              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                              <p className="text-xs leading-5 text-muted">
                                <strong className="block text-danger">Private key controls this address</strong>
                                Reveal only on a trusted offline device. Never photograph, paste, or share it.
                              </p>
                            </div>
                            {(() => {
                              const keyId = `${item.path}:${item.privateKey}`;
                              const isRevealed = revealedPrivateKeys.has(keyId);
                              return (
                                <Button variant="outline" size="sm" className="shrink-0" onClick={() => togglePrivateKey(keyId)}>
                                  {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                  {isRevealed ? "Hide private keys" : "Reveal private keys"}
                                </Button>
                              );
                            })()}
                          </div>

                          <dl>
                            <AddressDetailField label="Derivation path" value={item.path} id={`path-${item.index}`} copied={copied} onCopy={handleCopy} />
                            <AddressDetailField label="Address" value={item.address} id={`address-${item.index}`} copied={copied} onCopy={handleCopy} />
                            <AddressDetailField label={<GlossaryTerm definition="A public point derived from the private key. It helps construct the address and verify signatures but cannot authorize spending by itself.">Public key</GlossaryTerm>} value={item.publicKey} id={`pubkey-${item.index}`} copied={copied} onCopy={handleCopy} />
                            <AddressDetailField label="Public key hash" value={item.publicKeyHash} id={`pubkey-hash-${item.index}`} copied={copied} onCopy={handleCopy} />
                            <AddressDetailField label="ScriptPubKey" value={item.scriptPubKey} id={`script-${item.index}`} copied={copied} onCopy={handleCopy} />
                            <AddressDetailField label={<GlossaryTerm definition="The secret number that can sign transactions for this single address. Anyone who obtains it can spend that address's funds.">Private key (hex)</GlossaryTerm>} value={item.privateKey} id={`private-${item.index}`} copied={copied} onCopy={handleCopy} concealed={!revealedPrivateKeys.has(`${item.path}:${item.privateKey}`)} />
                            <AddressDetailField label={<GlossaryTerm definition="Wallet Import Format is a Base58Check encoding of the same private key, including network and compressed-key information.">Private key (WIF)</GlossaryTerm>} value={item.wif} id={`wif-${item.index}`} copied={copied} onCopy={handleCopy} concealed={!revealedPrivateKeys.has(`${item.path}:${item.privateKey}`)} />
                          </dl>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="flex min-h-44 items-center justify-center p-6 text-center text-sm text-muted">
                  <div><FileKey className="mx-auto mb-3 size-5" /><p>{details && !passphraseMatches ? "Confirm the passphrase exactly to derive this wallet." : "Addresses appear after the first entropy value."}</p></div>
                </div>
              )}
            </Card>

            <Card className="border-danger/20 bg-danger/[0.035] p-5 sm:p-6">
              <div className="flex gap-4">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-danger" />
                <div>
                  <h2 className="font-semibold">Use this as a learning and verification tool</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    For real funds, run the exported HTML on a permanently offline, trusted computer. Never paste an existing wallet phrase into a connected device. Verify the final entropy and first address with an independent implementation.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <footer className="mt-12 flex flex-col gap-4 border-t border-line pt-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" /> No network calls · no storage · no analytics</div>
          <div className="flex items-center gap-2">BIP39 <ChevronRight className="size-3" /> BIP32 <ChevronRight className="size-3" /> BIP84</div>
        </footer>
      </main>
    </div>
  );
}

export default App;
