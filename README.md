# Entropy Workbench

An offline-first educational workbench for seeing physical randomness become a BIP39 mnemonic, seed, BIP84 account, and Native SegWit Bitcoin addresses.

**[Open the live educational demo →](https://miguelmedeiros.github.io/entropy/)**

The hosted page is the same self-contained offline export produced by the reviewed build. Load it only with disposable workshop data, then disconnect if the exercise calls for an offline environment.

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
- Sampling several live camera frames into a local SHA-256 capture digest without saving or uploading images.
- Generating CSPRNG-backed coin flips, unbiased dice rolls, shuffled cards, or exact-size Hex for demonstrations.
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
npm ci
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

## Build and verify the offline release

```sh
npm ci
npm test
npm run export
npm run test:offline-export
```

`npm run export` runs the production build, including type checking, and writes the release artifact to `dist/index.html`. The final command verifies that this file is the only artifact and that it does not load external runtime resources. The `dist` directory is intentionally ignored by Git; build it from the reviewed source on the machine where it will be used.

For a workshop, copy only that generated HTML file to the presentation computer. For any exercise involving secrets, use disposable test vectors and a dedicated offline environment—never a funded wallet.

## Deterministic input format

Coin and card transcripts are normalized and domain-separated before hashing:

```text
entropy-workbench:v1|<source>|<normalized transcript>
```

Dice mode intentionally follows Ian Coleman's fixed-length conversion so the same rolls can be checked in both tools:

1. Normalize the physical faces to digits `1–6`.
2. Convert every face `6` to the base-6 digit `0`.
3. Hash that UTF-8 digit string once with SHA-256.
4. Use the first 128 digest bits for 12 words or all 256 bits for 24 words.

The interface identifies the selected conversion method and keeps the physical transcript separate from the final BIP39 entropy.

In Hex mode:

- Exactly 128 or 256 input bits are used directly as BIP39 entropy.
- Longer byte-aligned hexadecimal input is condensed with SHA-256.
- The first 128 or 256 digest bits become the final BIP39 entropy.

This transformation is deterministic. It does not rescue predictable, biased, reused, or human-invented source material.

## Independent cross-checking

To compare a disposable dice transcript with the Ian Coleman BIP39 tool:

1. Open **Verify with Ian Coleman** and copy **Dice rolls**.
2. In Ian Coleman, enable entropy input and select **Dice [1–6]**.
3. Select the same fixed mnemonic length: 12 or 24 words.
4. Paste the transcript and compare the mnemonic.

To compare the final BIP39 entropy instead:

1. Copy **BIP39 entropy (Hex)** from the verification accordion or Step B.
2. In Ian Coleman, select **Hex [0–9A–F]**.
3. Select **Use Raw Entropy (3 words per 32 bits)**—do not select the fixed-length override.
4. Paste the hexadecimal value.
5. Use the same exact BIP39 passphrase, Bitcoin mainnet, and BIP84 path before comparing wallet identity and addresses.

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
- **Camera uncertainty:** a 256-bit camera digest does not prove 256 bits of entropy. Static scenes, controlled lighting, image processing, virtual cameras, repeated captures, faulty sensors, or compromised hardware can make the input far more predictable than the digest length suggests.
- **Camera permissions:** the camera starts only after an explicit button press and is stopped after capture, cancellation, or leaving the camera tab. Raw frames are downsampled and hashed in memory; only the digest remains in the app state.
- **Card limit:** one uniformly shuffled 52-card deck contains at most about 225.6 bits, not 256 bits.
- **Implementation scope:** only the paths and formats listed above are supported; other wallets may use different networks, accounts, scripts, paths, languages, or extended-key versions.
- **No persistence is not erasure:** the app does not intentionally save data, but browsers and operating systems may still retain memory, clipboard, swap, screenshots, print jobs, or crash information.

## Data behavior

The application is designed without network requests, analytics, telemetry, accounts, cookies, local storage, or server-side components. All calculations happen in the browser tab. Camera frames are processed locally and are not saved or uploaded.

That design reduces exposure; it does **not** establish that the runtime environment or compiled file is safe.

## Safe workshop recommendation

Use only well-known public BIP39/BIP84 test vectors or throwaway entropy generated for the class. Clearly label every displayed mnemonic and private key as disposable. Close the tab after the exercise, clear the clipboard, and never send funds to demonstration addresses.

---

**If you are unsure whether it is safe to use this project for a real wallet, the answer is no. Use an audited wallet instead.**
