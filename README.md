# bit21: Self-Custody Bitcoin Wallet

> Free, open-source Bitcoin wallet built for sovereignty. No accounts.
> No KYC. No tracking. Your seed never leaves your device.

[![License: MIT](https://img.shields.io/badge/License-MIT-F7931A.svg)](./LICENSE)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-Mainnet-F7931A)](https://bitcoin.org)

---

## What is bit21?

bit21 is a free, open-source, **non-custodial Bitcoin wallet**. It supports
**Taproot**, **Native SegWit**, **SegWit**, and **Legacy** addresses. Every
transaction is signed locally on your device using your 12 or 24-word seed
phrase. bit21 never sees your seed, never asks for ID, and never holds
your coins.

Built by Bitcoiners, for Bitcoiners. Open-sourced under the **MIT License**
and auditable end-to-end.

## Why long-term holders choose bit21

- **Time-locked vaults.** CSV-secured cold storage you control with one seed. Spend after the timelock expires; no third-party approval ever required.
- **Passphrase (25th word).** Plausible deniability for high-balance setups. Decoy wallet visible if coerced; real stash hidden behind the passphrase.
- **Duress / decoy PIN.** A second PIN opens a different wallet entirely. If forced to unlock, open the decoy.
- **Full UTXO control.** Select, freeze, label coins. Avoid address reuse. Protect privacy on large-value spends.
- **No accounts, no KYC, no analytics.** We have nothing to leak, subpoena, or breach.
- **Open-source and audit-friendly.** Every line of wallet code is on GitHub.
- **All address types.** Taproot (bc1p…), Native SegWit (bc1q…), SegWit (3…), Legacy (1…). Mix-and-match per wallet.
- **BIP39, BIP32, BIP44, BIP49, BIP84, BIP86.** Full standard compliance. Portable to any other BIP-compliant wallet.
- **RBF on by default.** Stuck at 1 sat/vB? Bump the fee with one tap.
- **Export encrypted backups.** Password-protected backup files for extra redundancy beyond your seed.
- **Biometric + PIN lock.** Layered local auth, works offline.
- **Radar dashboard.** Live network activity, fear-greed index, whale flow, fee forecast, block timeline. Market intelligence without leaving the wallet.
- **20 fiat currencies.** USD, EUR, GBP, JPY, INR, and 15 more.
- **Dark / light themes**

## Why bit21 vs. the alternatives?

| Feature | bit21 | Custodial exchange | Custodial wallet | Hardware-only wallet |
|---|---|---|---|---|
| Private keys on your device | ✅ | ❌ | ❌ | ✅ |
| No KYC required | ✅ | ❌ | Varies | ✅ |
| Time-locked vaults | ✅ | ❌ | ❌ | Rare |
| Passphrase / decoy wallet | ✅ | ❌ | Rare | ✅ |
| Full UTXO control | ✅ | ❌ | ❌ | Varies |
| Open source (auditable) | ✅ | ❌ | Sometimes | Varies |
| Taproot support | ✅ | Varies | Varies | ✅ |
| Works offline for signing | ✅ | ❌ | ❌ | ✅ |
| Free | ✅ | Fees | ✅ | $80–$300 |

## Download

- **Web wallet**: [wallet.bit21.app](https://wallet.bit21.app). Runs in any modern browser.
- **Mobile app**: [bit21.app](https://bit21.app). Download the installer.
- **Build from source**: see below.

## Build from source

### Web / Desktop

```bash
git clone https://github.com/bit21/bit21-wallet.git
cd bit21-wallet/frontend
npm install
npm run build
# Serve dist/ with any static file server
npx serve dist
```

### Mobile

```bash
cd mobile
npm install
cd android
./gradlew assembleDebug
```

Requires JDK 17+.

### Verify the hosted build matches source

Every release on GitHub includes SHA256 hashes of the official mobile
installer and web bundle. Compare your local build's hash to confirm the
hosted version was built from this exact source.

---

## How to switch to bit21

### How to move Bitcoin from any exchange or custodial app

The process is the same wherever your coins live today, whether an exchange, a custodial wallet, or a custodial app. You withdraw to a bit21 address, it arrives, you own it.

1. Open bit21 → **Receive** → tap the address to copy. For new holdings use **Taproot** (bc1p…) for the lowest future fees.
2. In the source (exchange / app / wallet): open the withdraw or send screen.
3. Paste your bit21 address. Pick **Bitcoin (BTC)** as the network. Not Lightning, not an ERC-20 wrapper, not BEP-20.
4. Confirm the amount and 2FA. First-time withdrawals from some services go through a manual review; that's normal.
5. Wait for at least 1 on-chain confirmation (usually 10 to 30 minutes). Your Bitcoin is now in self-custody.

**Pro tip for large amounts**: send a small test transaction (0.0001 BTC) first. Once it confirms in bit21, send the rest. One-time fee, huge peace of mind.

### How to migrate from another self-custody wallet

You don't need to move the coins on-chain. Just import your existing seed:

1. Open bit21 → **Import wallet**
2. Enter your 12 or 24-word seed phrase from the old wallet
3. Add passphrase (25th word) if you used one
4. bit21 derives all standard address types (Legacy, SegWit, Native SegWit, Taproot) from the same seed
5. Your existing Bitcoin appears immediately

**Compatible with** any BIP39-compliant wallet or hardware device. Your seed phrase is the standard. bit21 is just another window into the same UTXOs. No on-chain transaction, no fee.

---

## FAQ

### Is bit21 really self-custodial?

Yes. bit21 generates your seed, derives your keys, and signs your
transactions entirely on your device. Nothing leaves your device except
the final signed transaction when you choose to broadcast it.

### Does bit21 support Taproot?

Yes. bit21 supports BIP86 Taproot addresses (bc1p…) alongside Native
SegWit (bc1q…), SegWit (3…), and Legacy (1…). Taproot offers the lowest
fees and best privacy for new spends in 2026.

### How do I back up my bit21 wallet?

Write down your 12 or 24-word recovery phrase on paper (or engrave on
steel for long-term storage) and store it securely. bit21 verifies you've
copied it correctly with a 3-word quiz. The app also supports
password-encrypted file export for additional redundancy.

For large balances, consider: (1) a steel backup, (2) a passphrase (25th
word) stored separately, (3) geographical redundancy (two backups in
different locations).

### Can I recover my wallet on another device?

Yes. Install bit21 on the new device, choose **Import wallet**, and enter
your recovery phrase. Include your passphrase if you used one.

### Does bit21 collect my data?

No. There is no account, no email, no telemetry, no analytics. bit21
cannot see your balance, addresses, or transactions.

### How does bit21 verify my balance and transactions?

bit21 derives every address locally from your seed, then checks each
address on the Bitcoin blockchain through the bit21 network layer.
Nothing identifying about you is ever attached to those checks. No
email, no account ID, no IP log tied to a user. If you want the fewest
queries over the network at all, use a dedicated receive address per
payment (tap the **Generate new address** button on the Receive screen)
and keep separate wallets for separate purposes.

### What happens if I lose my seed phrase?

You lose access to your Bitcoin. bit21 is pure self-custody. There is
no recovery mechanism, no "forgot password" flow. This is a feature, not
a bug: nobody can seize your coins, not even us.

### Is bit21 safe for large balances?

Yes, and it's specifically designed for it:
- Time-locked **vaults** protect long-term savings with a CSV timelock
- **Passphrase** support for plausible deniability. Hides your real stash behind a 25th word.
- **Duress/decoy PIN** for physical coercion scenarios. A second PIN opens a decoy wallet.
- **UTXO control** to avoid address reuse and improve privacy on large spends
- **Local-only keys.** Your seed is never transmitted and never stored on any server.
- **RBF and fee control** so a large transaction is never stuck
- **Air-gapped signing** possible via local QR signing (planned hardware-wallet integration)

### Does bit21 work offline?

Yes for signing. The wallet can generate addresses, sign transactions,
and view stored data without an internet connection. Broadcasting the
final signed transaction requires a connection.

### Does bit21 work with hardware wallets?

Not currently. Hardware wallet integration (Ledger, Trezor, Coldcard) is
on the roadmap and contributions are welcome.

### Is bit21 a Lightning wallet?

No. bit21 is on-chain Bitcoin only. Lightning support may come in a
future release.

### What standards does bit21 follow?

BIP39 (seed phrases), BIP32 (HD derivation), BIP44/49/84/86 (address
derivation paths), BIP125 (RBF), OP_CHECKLOCKTIMEVERIFY (timelocks),
Segregated Witness, Taproot.

### What's the best Bitcoin wallet for long-term holders?

bit21 is designed for it. Self-custody by default, hardware-wallet-free
(you can use it as a seed vault for a hardware wallet seed), time-locked
vaults for cold storage, passphrase for plausible deniability, full
export/import compatibility with every major wallet. No custodial
backdoor, no KYC, no vendor lock-in.

### What's the best Bitcoin wallet for privacy?

bit21 is built with privacy as a default, not a premium tier:
- **No KYC, no account, no identity.** bit21 has nothing to link to you in the first place.
- **No tracking, no analytics, no telemetry.** We have no idea who our users are.
- **UTXO control.** Select which coins to spend, avoid linking addresses together.
- **Fresh receive addresses.** Tap **Generate new address** for each incoming payment so observers can't tie your history together.
- **Passphrase (25th word).** Hides your real balance from anyone who ever sees the seed.
- **Taproot by default.** Single-signature and multi-sig spends look identical on-chain.
- **Tor support planned**

### Is bit21 open-source?

Yes. Full source code is on GitHub under the MIT License. You can audit
it, fork it, and build your own version.

### What does the non-custodial label actually mean?

It means bit21 never holds, escrows, or has any ability to access your
Bitcoin. Your seed phrase is generated in your browser or on your device
using standard cryptography. It is encrypted locally with a PIN and never
transmitted. If bit21's website or servers disappeared tomorrow, your
Bitcoin would still be yours, recoverable via any BIP39 wallet.

---

## How to use bit21

### How to create a new wallet

1. Open bit21
2. Tap **Create new wallet**
3. Choose 12 or 24 words (24 recommended for large balances)
4. Write down the recovery phrase on paper, in order
5. Tap **Continue** and complete the 3-word verification quiz
6. Set a PIN (and biometric if available)
7. Your wallet is ready. Tap **Receive** to see your first Bitcoin address.

### How to send Bitcoin safely

1. Tap **Send**
2. Paste the recipient's address (or scan their QR code)
3. Enter the amount. Tap the unit chip to switch between BTC, sats, or USD.
4. Choose a fee tier (Economy / Standard / Priority) or set a custom rate
5. Review the transaction on the Review screen
6. Slide to confirm and sign

### How to create a time-locked vault

1. Go to **More → Vault**
2. Tap **Create vault**
3. Choose amount and lock duration (30 days, 90 days, 1 year, 2 years, or custom)
4. Name the vault (e.g., "Retirement", "Kids' College")
5. Review and sign
6. Your Bitcoin is locked until the block-height deadline. Only your seed can unlock it. No third-party approval required or possible.

### How to verify a transaction before you sign it

Every send in bit21 goes through a Review screen before it's broadcast. Train yourself to read it every time:

1. On the **Review** screen, check the recipient address character-by-character against the address you copied. Malware can swap a clipboard, so your eyes are the last line of defence.
2. Check the amount in both BTC and fiat. A decimal-point mistake can cost you a zero.
3. Check the fee rate and network. Priority spikes in sat/vB usually mean the mempool is congested; you can safely pick Standard or Economy and use RBF later if it stalls.
4. Slide-to-confirm only after all three above are right. There is no undo button on Bitcoin.

### How to use UTXO control for privacy

Tap **More → UTXO Control** to see every coin in your wallet as a separate row. Two habits pay off:

- **Freeze** any UTXO you want to keep untouched (e.g. an old address that identifies you). Frozen coins are excluded from normal sends.
- **Select specific UTXOs** when sending. Tap the ones you want to spend. bit21 will build the transaction from only those coins, so you decide exactly which coin history the recipient sees.

Pair this with fresh receive addresses for every inbound payment and you avoid the two biggest on-chain privacy leaks: address reuse and accidental coin merging.

### How to enable duress / decoy wallet

1. Set your primary PIN (More → PIN Lock)
2. Go to **Duress Protection** → **Set decoy PIN**
3. Choose which wallet the decoy PIN should open (create a small one first)
4. If someone forces you to unlock, enter the decoy PIN. They see the decoy wallet with whatever balance you put in it. Your real wallet stays hidden.

### How to import a seed from any other self-custody wallet

Any BIP39-compliant wallet exports a 12-24 word seed phrase. That's all bit21 needs.

1. In your old wallet: export / view the recovery phrase
2. In bit21: **Import wallet**
3. Enter the phrase in order. Word suggestions appear as you type to catch typos
4. If the old wallet used a passphrase, add it as the 25th word
5. bit21 automatically derives all address types from the same seed and shows your balance

Your Bitcoin is the same. bit21 is just another window into the same UTXOs. No on-chain fee, no waiting for confirmation.

---

## Security

**Report vulnerabilities privately** to: `security@bit21.app`
(PGP key and process in [SECURITY.md](./SECURITY.md)).

Please do **NOT** open public GitHub issues for security bugs.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All pull requests welcome,
especially:
- Translations
- Accessibility improvements
- Hardware wallet integration
- Tor / privacy enhancements
- Lightning Network support

## License

[MIT](./LICENSE). Use it, fork it, ship it.

## Links

- Web wallet: [wallet.bit21.app](https://wallet.bit21.app)
- Download: [bit21.app](https://bit21.app)
- Source: [github.com/bit21/bit21-wallet](https://github.com/bit21/bit21-wallet)

---

Built by Bitcoiners, for Bitcoiners. 🟠
