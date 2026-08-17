import type { PassphraseStrength } from "../lib/passphrase";
import { formatEstimatedGuesses } from "../lib/passphrase";
import { cn } from "../lib/utils";

export function PassphraseStrengthMeter({ strength }: { strength: PassphraseStrength | null }) {
  if (!strength) {
    return (
      <div className="mt-3 rounded-xl border border-line bg-ink/[0.025] px-3 py-2 text-[11px] leading-5 text-muted">
        No passphrase is valid. Wallet security still depends on protecting the mnemonic.
      </div>
    );
  }

  const tone = strength.score <= 1 ? "text-danger" : strength.score === 2 ? "text-accent" : "text-success";
  const activeBar = strength.score <= 1 ? "bg-danger" : strength.score === 2 ? "bg-accent" : "bg-success";
  const guidance = strength.warning
    ?? strength.suggestions[0]
    ?? (strength.score >= 3
      ? "No obvious common pattern was detected. Keep an exact separate backup."
      : "Prefer several independently chosen, unrelated random words.");

  return (
    <div className="mt-3 rounded-xl border border-line bg-ink/[0.025] p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-muted">Estimated passphrase strength</span>
        <strong className={tone}>{strength.label}</strong>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" role="meter" aria-label="Passphrase strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength.score}>
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={cn("h-1.5 rounded-full", index <= strength.score ? activeBar : "bg-ink/10")}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[11px] leading-5 text-muted sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <span>{guidance}</span>
        <span className="shrink-0 font-mono text-ink/75">{formatEstimatedGuesses(strength.guessesLog10)}</span>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-muted">Pattern-aware offline estimate, not a guarantee.</p>
    </div>
  );
}
