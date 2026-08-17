import { Check, Circle, FileCheck2, Hash, KeyRound, Sparkles, X } from "lucide-react";
import type { MnemonicDetails } from "../lib/crypto";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

export type VerifyKind = "hex" | "mnemonic" | "complete";

function ResultRow({
  label,
  status,
}: {
  label: string;
  status: "waiting" | "match" | "mismatch";
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {status === "match" ? (
        <Check className="size-4 text-success" />
      ) : status === "mismatch" ? (
        <X className="size-4 text-danger" />
      ) : (
        <Circle className="size-3.5 text-muted/50" />
      )}
      <span className={cn(status === "match" && "text-success", status === "mismatch" && "text-danger")}>
        {label}
      </span>
    </div>
  );
}

function comparisonStatus(expected: string, actual: string) {
  if (!expected.trim() || !actual) return "waiting" as const;
  return expected.trim().toLowerCase() === actual.toLowerCase() ? "match" as const : "mismatch" as const;
}

export function VerifyPanel({
  kind,
  onKindChange,
  input,
  onInputChange,
  error,
  details,
  expectedAddress,
  onExpectedAddressChange,
  expectedPublicKey,
  onExpectedPublicKeyChange,
  actualAddress,
  actualPublicKey,
  completionCandidateCount,
  completionMissingBits,
  completedMnemonic,
  onCompletePhrase,
}: {
  kind: VerifyKind;
  onKindChange: (kind: VerifyKind) => void;
  input: string;
  onInputChange: (value: string) => void;
  error: string | null;
  details: MnemonicDetails | null;
  expectedAddress: string;
  onExpectedAddressChange: (value: string) => void;
  expectedPublicKey: string;
  onExpectedPublicKeyChange: (value: string) => void;
  actualAddress: string;
  actualPublicKey: string;
  completionCandidateCount: number;
  completionMissingBits: number | null;
  completedMnemonic: string;
  onCompletePhrase: () => void;
}) {
  const addressStatus = comparisonStatus(expectedAddress, actualAddress);
  const publicKeyStatus = comparisonStatus(expectedPublicKey, actualPublicKey);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">Check or complete a result</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          Paste public test data only. Nothing leaves this device.
        </p>
      </div>

      <Tabs value={kind} onValueChange={(value) => onKindChange(value as VerifyKind)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hex" aria-label="Verify hexadecimal entropy"><Hash className="size-4" /> Hex</TabsTrigger>
          <TabsTrigger value="mnemonic" aria-label="Verify mnemonic"><KeyRound className="size-4" /> Mnemonic</TabsTrigger>
          <TabsTrigger value="complete" aria-label="Complete mnemonic"><Sparkles className="size-4" /> Complete</TabsTrigger>
        </TabsList>
      </Tabs>

      <div>
        <label htmlFor="verify-input" className="text-xs font-semibold">
          {kind === "hex" ? "BIP39 entropy" : kind === "mnemonic" ? "BIP39 mnemonic" : "First 11 or 23 BIP39 words"}
        </label>
        <textarea
          id="verify-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          spellCheck={false}
          placeholder={kind === "hex" ? "32 or 64 hexadecimal characters" : kind === "mnemonic" ? "12 or 24 English BIP39 words" : "Enter exactly 11 or 23 English BIP39 words"}
          className="sensitive scrollbar-thin mt-2 min-h-28 w-full resize-y rounded-xl border border-line bg-surface/70 px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        {error && <p className="mt-2 rounded-lg bg-danger/[0.06] px-3 py-2 text-xs leading-5 text-danger">{error}</p>}
        {details && (
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-success">
            <FileCheck2 className="size-4" /> Valid {details.words.length}-word BIP39 result
          </p>
        )}
      </div>

      {kind === "complete" && completionCandidateCount > 0 && completionMissingBits !== null && (
        <div className="rounded-xl border border-accent/25 bg-accent/[0.055] p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {completionCandidateCount} valid final words · {completionMissingBits} entropy bits still missing
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                These words do not determine one unique answer. The browser will securely choose the missing entropy, then BIP39 supplies the checksum bits in the final word.
              </p>
            </div>
          </div>

          <Button type="button" variant="accent" className="mt-4 w-full" onClick={onCompletePhrase}>
            <Sparkles className="size-4" /> {completedMnemonic ? "Choose another valid final word" : "Generate final word securely"}
          </Button>

          {completedMnemonic && (
            <div className="sensitive mt-4 rounded-lg border border-line bg-surface/70 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Completed mnemonic</div>
              <p className="mt-2 break-words font-mono text-xs leading-5 text-ink">{completedMnemonic}</p>
              <p className="mt-2 text-xs text-muted">
                Final word: <strong className="font-mono text-accent">{completedMnemonic.split(" ").at(-1)}</strong>
              </p>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-5 text-danger">
            This completes a valid BIP39 phrase; it does not make human-chosen words unpredictable.
          </p>
        </div>
      )}

      <div className="border-t border-line pt-5">
        <h3 className="text-sm font-semibold">Compare another tool</h3>
        <p className="mt-1 text-xs leading-5 text-muted">Optional: paste its first BIP84 result.</p>
        <div className="mt-3 space-y-2">
          <input
            value={expectedAddress}
            onChange={(event) => onExpectedAddressChange(event.target.value)}
            placeholder="Expected bc1… address"
            aria-label="Expected first BIP84 address"
            className="h-10 w-full rounded-xl border border-line bg-surface/70 px-3 font-mono text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
          <input
            value={expectedPublicKey}
            onChange={(event) => onExpectedPublicKeyChange(event.target.value)}
            placeholder="Expected compressed public key"
            aria-label="Expected first BIP84 public key"
            className="h-10 w-full rounded-xl border border-line bg-surface/70 px-3 font-mono text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-surface/55 p-4">
        <ResultRow label={details ? "Mnemonic/checksum is valid" : "Waiting for a valid input"} status={details ? "match" : "waiting"} />
        <ResultRow label={addressStatus === "match" ? "First address matches" : addressStatus === "mismatch" ? "First address does not match" : "First address not compared"} status={addressStatus} />
        <ResultRow label={publicKeyStatus === "match" ? "Public key matches" : publicKeyStatus === "mismatch" ? "Public key does not match" : "Public key not compared"} status={publicKeyStatus} />
      </div>

      <div className="rounded-xl border border-accent/20 bg-accent/[0.05] p-4 text-xs leading-5 text-muted">
        <strong className="block text-ink">Before comparing, confirm:</strong>
        <span className="mt-2 block">Same final entropy or mnemonic · same passphrase · Bitcoin mainnet · path <code className="font-mono text-ink">m/84'/0'/0'/0/0</code></span>
      </div>
    </div>
  );
}
