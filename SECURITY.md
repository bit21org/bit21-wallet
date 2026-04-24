# Security Policy

## Reporting a Vulnerability

Please report security issues privately to: **security@bit21.app**

For sensitive reports, encrypt with our PGP key (fingerprint to be published
with the first tagged release).

**Please do NOT open public GitHub issues for security bugs.** Public
disclosure before a fix is available puts every user at risk.

## Response timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 7 days
- **Fix or mitigation**: within 30 days for critical / high-severity issues

## Scope

### In scope
- Seed phrase generation and derivation (BIP39, BIP32)
- Transaction signing (PSBT, standard Bitcoin scripts)
- Local key storage (encryption of seed at rest)
- PIN and biometric lock mechanisms
- Client-side cryptographic operations
- Build reproducibility issues
- App signing and distribution integrity

### Out of scope
- Social engineering attacks against users or maintainers
- Physical device compromise
- Issues in third-party dependencies (please report to the upstream project)
- Theoretical quantum attacks
- UI / UX bugs that do not affect fund safety (open a regular GitHub issue)

## Responsible Disclosure

We ask that you give us a reasonable window to fix issues before public
disclosure — typically 90 days or until a fix is released, whichever is
sooner.

In exchange, we will:

- Credit you in the release notes (if desired)
- Keep you informed of our progress
- Not pursue legal action for good-faith research
- Consider a bug bounty for critical findings (discretionary)

## Security assumptions

bit21 is a self-custody wallet. Security depends on:

1. **Your device is not compromised.** A malicious app or OS-level malware
   can steal your seed regardless of wallet design.
2. **You store your seed phrase securely offline.** bit21 cannot recover
   a lost seed.
3. **You verify the app signature before install.** Download the APK only
   from official sources; compare SHA256 to the GitHub Release.

## Audit status

bit21 has not yet undergone a formal third-party audit. The code is
open-source and welcomes independent review.
