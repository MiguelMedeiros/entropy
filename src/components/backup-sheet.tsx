import { ArrowLeft, CheckCircle2, ClipboardCheck, Printer, RotateCcw, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { chooseSecureIndices, type DerivedAddress, type MnemonicDetails } from "../lib/crypto";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export function BackupSheet({
  details,
  firstAddress,
  hasPassphrase,
  onBack,
}: {
  details: MnemonicDetails;
  firstAddress?: DerivedAddress;
  hasPassphrase: boolean;
  onBack: () => void;
}) {
  const [challengePositions, setChallengePositions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");

  const startChallenge = () => {
    setChallengePositions(chooseSecureIndices(details.words.length, 3));
    setAnswers({});
    setResult("idle");
  };

  const checkBackup = () => {
    const matches = challengePositions.every(
      (position) => answers[position]?.trim().toLowerCase() === details.words[position],
    );
    setResult(matches ? "success" : "error");
  };

  const challengeComplete = challengePositions.every((position) => answers[position]?.trim());

  return (
    <div className="backup-page min-h-screen bg-canvas px-4 py-6 text-ink sm:px-8">
      <div className="no-print mx-auto mb-5 max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="size-4" /> Back</Button>
          <div className="hidden text-center text-xs text-muted sm:block">Use a trusted offline printer. Printer queues may retain copies.</div>
          <Button variant="accent" onClick={() => window.print()}><Printer className="size-4" /> Print backup</Button>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
          {challengePositions.length === 0 ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <h2 className="font-semibold">Verify your paper backup</h2>
                  <p className="mt-1 text-xs leading-5 text-muted">After printing or copying the words, test three random positions before funding the wallet.</p>
                </div>
              </div>
              <Button variant="outline" onClick={startChallenge}>Start backup check</Button>
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold">Read these words from your paper</h2>
                  <p className="mt-1 text-xs leading-5 text-muted">The on-screen recovery words are hidden during this check.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={startChallenge}><RotateCcw className="size-3.5" /> New positions</Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {challengePositions.map((position) => (
                  <label key={position} className="text-xs font-semibold">
                    Word {position + 1}
                    <input
                      value={answers[position] ?? ""}
                      onChange={(event) => {
                        setAnswers((current) => ({ ...current, [position]: event.target.value }));
                        setResult("idle");
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs">
                  {result === "success" && <span className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="size-4" /> Backup check passed.</span>}
                  {result === "error" && <span className="flex items-center gap-2 font-semibold text-danger"><XCircle className="size-4" /> One or more words do not match. Check the paper carefully.</span>}
                </div>
                <Button onClick={checkBackup} disabled={!challengeComplete}>Verify words</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <main className={cn("backup-sheet mx-auto max-w-4xl bg-white p-8 shadow-soft transition sm:p-12", challengePositions.length > 0 && "pointer-events-none select-none blur-md")}>
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent">Offline recovery record</p>
            <h1 className="mt-2 font-display text-4xl font-semibold">Bitcoin wallet backup</h1>
          </div>
          <div className="rounded-lg border border-ink px-3 py-2 text-right font-mono text-xs">
            BIP39 · {details.words.length} words<br />BIP84 · Mainnet
          </div>
        </header>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Recovery words</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">Write and verify every word</h2>
            </div>
            <span className="font-mono text-xs">Copy ____ of ____</span>
          </div>
          <ol className={`grid gap-2 ${details.words.length === 24 ? "grid-cols-4" : "grid-cols-3"}`}>
            {details.words.map((word, index) => (
              <li key={`${index}-${word}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-3">
                <span className="w-5 text-right font-mono text-[9px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                <strong className="font-mono text-sm">{word}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-5">
          <div className="rounded-xl border border-line p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Wallet settings</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt>Network</dt><dd className="font-mono font-semibold">Bitcoin mainnet</dd></div>
              <div className="flex justify-between gap-4"><dt>Script</dt><dd className="font-mono font-semibold">Native SegWit</dd></div>
              <div className="flex justify-between gap-4"><dt>Path</dt><dd className="font-mono font-semibold">m/84'/0'/0'</dd></div>
              <div className="flex justify-between gap-4"><dt>BIP39 passphrase</dt><dd className="font-mono font-semibold">{hasPassphrase ? "YES" : "NO"}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border-2 border-danger/50 bg-danger/[0.035] p-5">
            <div className="flex items-center gap-2 text-danger"><ShieldAlert className="size-4" /><strong className="text-xs uppercase tracking-wider">Keep offline</strong></div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Anyone with these words can control the wallet. Never photograph or upload this sheet.
              {hasPassphrase && " Store the passphrase separately — it is intentionally not printed here."}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-line p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Verification data · not secret on its own</p>
          <div className="mt-3 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 font-mono text-[10px] leading-5">
            <span className="text-muted">First address</span><span className="break-all">{firstAddress?.address ?? "—"}</span>
            <span className="text-muted">Public key</span><span className="break-all">{firstAddress?.publicKey ?? "—"}</span>
          </div>
        </section>

        <footer className="mt-8 grid grid-cols-3 gap-6 border-t border-line pt-6 text-xs">
          <div><span className="text-muted">Created</span><div className="mt-5 border-b border-ink" /></div>
          <div><span className="text-muted">Verified independently</span><div className="mt-5 border-b border-ink" /></div>
          <div><span className="text-muted">Storage location</span><div className="mt-5 border-b border-ink" /></div>
        </footer>
      </main>
    </div>
  );
}
