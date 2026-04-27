# Contributing to bit21

Thanks for considering a contribution. bit21 is maintained by a small team,
so responses may be slower than a corporate project, but every PR is read
and appreciated.

## Getting started

```bash
git clone https://github.com/bit21/bit21-wallet.git
cd bit21-wallet/frontend
npm install
npm run dev
# open http://localhost:5173
```

## Requirements

- **Node.js 18+**
- For mobile builds: **JDK 17+**

## Code style

- Functional React components with hooks
- Inline CSS-in-JS (no CSS frameworks; we keep the bundle small for a PWA)
- Use existing primitives from `frontend/src/components/DesignSystem.jsx`
- Minimize new dependencies; discuss in an issue first

## Pull Requests

1. **One feature per PR.** Smaller PRs get reviewed faster.
2. **Describe the user-facing change** in the PR description
3. **Test on both web and mobile** before submitting
4. **Update docs** (README, FAQ) if behavior changes
5. **Sign your commits** with GPG (`git commit -S`). Helps trust signal.

## What we'll accept

- Bug fixes (always welcome)
- Accessibility improvements
- Translations (i18n in `frontend/src/lib/i18n.js`)
- Hardware wallet integration (Ledger, Trezor, Coldcard)
- Lightning Network support (long-term goal)
- Additional fiat currencies
- Code simplification / readability improvements
- Security improvements

## What we won't merge

- Custodial features (bit21 is self-custody only)
- KYC / identity verification
- Analytics, tracking, telemetry
- Features that weaken self-custody invariants
- Dependencies with questionable licensing or maintenance

## Reporting bugs

Open a GitHub issue with:
- Platform (Web / Mobile)
- Version (check "Settings → About" or package.json)
- Steps to reproduce
- Expected vs. actual behavior
- Any relevant console errors

For **security bugs**, see [SECURITY.md](./SECURITY.md) instead.

## Questions

Prefer public discussion via GitHub issues so answers help everyone.

Thank you for helping make self-custody accessible.
