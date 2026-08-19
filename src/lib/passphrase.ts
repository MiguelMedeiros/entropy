import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary as commonDictionary } from "@zxcvbn-ts/language-common";
import { translations } from "@zxcvbn-ts/language-en";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export interface PassphraseStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  guessesLog10: number;
  warning: string | null;
  suggestions: string[];
}

const checker = new ZxcvbnFactory({
  translations,
  graphs: adjacencyGraphs,
  dictionary: {
    ...commonDictionary,
    "bip39-english": wordlist,
  },
});

const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;

export function estimatePassphraseStrength(value: string): PassphraseStrength | null {
  if (!value) return null;
  const result = checker.check(value);

  return {
    score: result.score,
    label: labels[result.score],
    guessesLog10: result.guessesLog10,
    warning: result.feedback.warning,
    suggestions: result.feedback.suggestions,
  };
}

export function formatEstimatedGuesses(guessesLog10: number): string {
  if (guessesLog10 < 3) return "fewer than 1,000 guesses";
  return `about 10^${Math.floor(guessesLog10)} guesses`;
}
