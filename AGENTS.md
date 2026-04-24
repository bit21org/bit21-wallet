# AGENTS.md — AI Coding Agent Instructions

This file helps AI coding assistants (GitHub Copilot, Claude Code, Cursor,
Aider, Devin, etc.) work effectively on this repository.

## What this project is

**bit21** is a self-custody Bitcoin wallet. Client-only — no backend code
in this repository. The wallet signs every transaction locally on the
user's device and talks to the bit21 network layer for blockchain data.

## Tech stack

- **Frontend**: React 18 + Vite 5, plain JavaScript (no TypeScript)
- **Styling**: Inline CSS-in-JS, no frameworks
- **Bitcoin**: `bitcoinjs-lib`, `bip39`, `bip32`, `tiny-secp256k1`
- **Mobile**: Capacitor wrapper
- **No backend code** in this repo — public Bitcoin APIs only

## Build & test commands

```bash
# Frontend dev server
cd frontend && npm install && npm run dev

# Frontend production build
cd frontend && npm run build

# Mobile debug build
cd mobile && npm install
cd android && ./gradlew assembleDebug
```

## Key files

- `frontend/src/App.jsx` — top-level wallet state + routing
- `frontend/src/pages/Wallet.jsx` — main wallet UI (all tabs)
- `frontend/src/pages/Create.jsx` — new wallet creation + seed verification
- `frontend/src/pages/Import.jsx` — wallet import from seed or WIF
- `frontend/src/lib/bitcoin.js` — Bitcoin cryptography primitives (derivation, signing, vaults)
- `frontend/src/lib/api.js` — network calls for blockchain data and market data
- `frontend/src/lib/i18n.js` — translations
- `frontend/src/components/DesignSystem.jsx` — shared UI primitives

## Invariants to preserve

1. **Self-custody**: seeds and private keys must never leave the device
2. **No accounts**: no sign-up flow, no email, no user tracking
3. **No analytics**: no telemetry, no crash reporting to third parties
4. **No identity in network calls**: blockchain lookups carry no user identifier
5. **Deterministic derivation**: BIP39/32/44/49/84/86 standards; test with known test vectors

## Do NOT

- Add any server-side code (this repo is client-only)
- Add analytics, tracking, telemetry, or fingerprinting
- Add custodial features (held funds, hot wallets managed by a service)
- Add KYC / identity verification
- Add dependencies with non-permissive licenses
- Store seed phrases unencrypted
- Send seed phrases over the network for any reason
- Attach any user identifier (email, account ID, device fingerprint) to blockchain lookups

## Style

- Functional React components with hooks
- Use existing `DesignSystem.jsx` primitives (`Crd`, `Inp`, `PBtn`, `SBtn`, `Tog`, `Bk`, `PT`)
- Inline `style={{...}}` objects; no CSS files, no Tailwind, no styled-components
- Keep bundle size small — minimize new dependencies

## Testing

Manual test checklist for any change that touches wallet functionality:
1. Create new wallet → verify 3-word quiz works → wallet loads
2. Import existing wallet → derivation matches expected address
3. Send transaction → RBF flag set in the signed tx → confirms on-chain
4. Create time-locked vault → spend after locktime expires

## Helpful references

- Bitcoin BIPs: https://github.com/bitcoin/bips
- bitcoinjs-lib docs: https://github.com/bitcoinjs/bitcoinjs-lib
- Capacitor: https://capacitorjs.com/docs
