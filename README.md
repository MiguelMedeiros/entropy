# Entropy Workbench

An offline-first educational workbench for seeing physical randomness become a BIP39 mnemonic, seed, BIP84 account, and Native SegWit Bitcoin addresses.

> [!CAUTION]
> ## EDUCATIONAL SOFTWARE ONLY — DO NOT USE THIS PROJECT TO SECURE REAL FUNDS
>
> This project was created for workshops, demonstrations, learning, and cross-checking public test vectors. It has **not been professionally audited**, formally verified, or reviewed as production wallet software.
>
> **Do not use it to create, import, recover, protect, or manage a wallet containing real bitcoin. Do not paste an existing mnemonic, passphrase, seed, private key, or other real wallet secret into this page—especially on an internet-connected computer.**
>
> Running a page “offline” does not prove that the computer, browser, browser extensions, operating system, clipboard, printer, or downloaded file is trustworthy. A compromised environment can steal secrets without making a network request while you are using the tool and transmit them later.
>
> The entropy estimates, passphrase-strength meter, checksum validation, address derivation, printable backup, and verification exercises are educational aids—not security guarantees. Hashing weak or human-chosen input does not create missing randomness. A valid checksum only proves structural validity; it does not prove that a wallet is secure or that it is the wallet you intended.
>
> The authors and contributors provide this software **as is**, without warranty of any kind, and accept no responsibility for lost funds, exposed keys, incorrect backups, incompatible wallets, implementation defects, user error, or any other damage. For real funds, use reputable, audited hardware/software wallets and independently verified procedures.

## What this project demonstrates

- Recording physical entropy from fair coin flips, six-sided dice, or cards drawn without replacement.
- Generating 128-bit or 256-bit entropy with the browser CSPRNG for demonstrations.
- Estimating source entropy without pretending that hashing adds randomness.
- Converting entropy into BIP39 checksum bits, 11-bit indexes, and 12/24 recovery words.
- Completing an 11- or 23-word partial phrase by securely selecting one valid final word.
- Confirming an optional BIP39 passphrase twice before deriving wallet data.
- Estimating passphrase strength locally using dictionary, pattern, sequence, and repetition analysis.
- Deriving the BIP39 seed and the first five Bitcoin mainnet BIP84 P2WPKH addresses.
- Showing master fingerprint, account XPUB/ZPUB, compressed public keys, ScriptPubKeys, private-key hex, and WIF.
- Comparing a first address or compressed public key with another implementation.
- Verifying exact hexadecimal entropy or an existing 12/24-word mnemonic.
- Printing an A4 recovery sheet and testing three random word positions from the paper copy.
- Explaining unfamiliar terms through contextual glossary tooltips.
- Presenting sensitive values behind privacy/reveal controls.
- Switching between light and dark themes.
- Exporting one self-contained HTML file that runs without a server.

## Deliberate scope

The interface intentionally stays focused on:

- English BIP39 mnemonics
- 12 or 24 words
- Bitcoin mainnet
- Native SegWit P2WPKH
- BIP84 receiving path `m/84'/0'/0'/0/i`
- Education and interoperability checks

It is not a wallet. It does not connect to the Bitcoin network, query balances, construct transactions, sign transactions, broadcast transactions, or persist wallet data.

## Development

Requirements: a current Node.js release and npm.

```sh
npm install
npm run dev
```

Run the automated verification suite and production build:

```sh
npm test
npm run build
```

Check installed packages for known vulnerabilities:

```sh
npm audit
```

## Export one offline HTML file

```sh
npm run export
```

The exported application is written to `dist/index.html`. The `dist` directory is intentionally ignored by Git; build it from the reviewed source on the machine where it will be used.

For a workshop, copy only that generated HTML file to the presentation computer. For any exercise involving secrets, use disposable test vectors and a dedicated offline environment—never a funded wallet.

## Deterministic input format

Coin, dice, and card transcripts are normalized and domain-separated before hashing:

```text
entropy-workbench:v1|<source>|<normalized transcript>
```

The UTF-8 text is hashed once with SHA-256. A 12-word mnemonic uses the first 128 digest bits; a 24-word mnemonic uses all 256 bits.

In Hex mode:

- Exactly 128 or 256 input bits are used directly as BIP39 entropy.
- Longer byte-aligned hexadecimal input is condensed with SHA-256.
- The first 128 or 256 digest bits become the final BIP39 entropy.

This transformation is deterministic. It does not rescue predictable, biased, reused, or human-invented source material.

## Independent cross-checking

To compare a disposable test vector with the Ian Coleman BIP39 tool:

1. Open **Show entropy details**.
2. Copy the value from **Step B → entropy**.
3. In the other implementation, enable entropy input and select **Hex**.
4. Use the same mnemonic length, exact BIP39 passphrase, Bitcoin mainnet, and BIP84 path.
5. Compare the mnemonic, master fingerprint, account extended key, and first receiving address.

Two matching browser tools are useful for learning, but they are not automatically independent if they share libraries, assumptions, compromised dependencies, or the same unsafe computer.

## Security limitations you must understand

- **No audit:** passing tests does not make this production wallet software.
- **Mnemonic exposure:** anyone with the recovery words can control the wallet unless an additional passphrase is required.
- **Passphrase behavior:** every passphrase—including a typo—creates a valid, different wallet. There is no authoritative “wrong passphrase” error.
- **Strength estimates:** the passphrase meter detects many common patterns but cannot prove randomness or predict every attack.
- **Clipboard exposure:** copying entropy, mnemonics, seeds, or private keys can leave them available to the OS and other applications.
- **Browser exposure:** extensions, developer tools, injected scripts, accessibility software, crash reports, and compromised browser binaries may observe page contents.
- **Printer exposure:** printer memory, queues, spool files, Wi-Fi printers, and managed print services may retain recovery sheets.
- **XPUB/ZPUB privacy:** extended public keys cannot spend funds, but they reveal all addresses and transaction history for the account.
- **Private-key display:** per-address private keys are derived in memory and can be revealed. Revealing or copying them is dangerous.
- **Weak entropy:** hashing birthdays, quotations, keyboard mashing, repeated dice results, biased coins, or other predictable material does not make it secure.
- **Card limit:** one uniformly shuffled 52-card deck contains at most about 225.6 bits, not 256 bits.
- **Implementation scope:** only the paths and formats listed above are supported; other wallets may use different networks, accounts, scripts, paths, languages, or extended-key versions.
- **No persistence is not erasure:** the app does not intentionally save data, but browsers and operating systems may still retain memory, clipboard, swap, screenshots, print jobs, or crash information.

## Data behavior

The application is designed without network requests, analytics, telemetry, accounts, cookies, local storage, or server-side components. All calculations happen in the browser tab.

That design reduces exposure; it does **not** establish that the runtime environment or compiled file is safe.

## Safe workshop recommendation

Use only well-known public BIP39/BIP84 test vectors or throwaway entropy generated for the class. Clearly label every displayed mnemonic and private key as disposable. Close the tab after the exercise, clear the clipboard, and never send funds to demonstration addresses.

---

**If you are unsure whether it is safe to use this project for a real wallet, the answer is no. Use an audited wallet instead.**
