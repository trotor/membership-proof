# Membership Proof

Privacy-preserving membership verification for sports clubs and non-profits.

**[Try the live demo](https://trotor.github.io/membership-proof/)**

## Overview

Membership Proof lets organizations verify that someone is a member without storing or transmitting personal data. All processing happens client-side in the browser.

### Two Code Systems

| System | Best For | How It Works |
|--------|----------|--------------|
| **Simple 6-digit codes** | Quick verification, no names needed | Specify count, get codes, distribute to members |
| **QR codes with names** | Need to see member name on verification | Upload surname list, get QR codes, scan reveals name |

## Quick Start

### For Administrators (Generating Codes)

**Simple 6-digit codes:**
1. Enter a Club ID (e.g., `SWIM-CLUB-2024`)
2. Enter an Admin Password (keep this secret!)
3. Specify how many codes you need
4. Click "Generate Codes"
5. Share the **Club Key** with verifiers (coaches, officials)
6. Distribute one code to each member

**QR codes with names:**
1. Prepare a CSV file with member surnames (one per line)
2. Select "QR codes with names"
3. Enter Club ID and Admin Password
4. Upload the CSV file
5. Share the **Club Key** with verifiers
6. Send each QR code to the respective member

### For Verifiers (Checking Membership)

**Simple codes:**
1. Enter the Club Key and Club ID
2. Ask member for their 6-digit code
3. Click "Verify" - shows VALID or INVALID

**QR codes:**
1. First time: Enter the Club Key (saved automatically)
2. Scan member's QR code with phone camera
3. Page opens and shows: `VALID MEMBER: LASTNAME`

## How It Works

### Simple 6-Digit Codes

```
Code format: RRRSSS (e.g., 847291)
  RRR: Random identifier (000-999)
  SSS: HMAC signature mod 1000

Verification: HMAC(club_key, club_id + identifier) mod 1000 == signature
```

- Maximum 1000 unique codes per Club ID
- Forgery probability: 0.1% per attempt
- No personal data in the code

### QR Codes with Names

```
QR contains URL: https://your-site.com/?verify=ENCRYPTED_DATA

ENCRYPTED_DATA = AES-GCM(club_key, {name: "LASTNAME", index: 5})
```

- Name is encrypted with the club key
- Only someone with the club key can decrypt
- Scanning opens the verification page automatically

## Security

| Feature | Implementation |
|---------|----------------|
| Key derivation | PBKDF2 with 100,000 iterations |
| Code signing | HMAC-SHA256 |
| Name encryption | AES-256-GCM |
| Data storage | None - all client-side |

### Trade-offs

This system prioritizes **usability over maximum security**:

- 6-digit codes are easy to remember but have 0.1% forgery probability
- Suitable for sports clubs and community organizations
- Not recommended for high-security applications
- Regenerate codes annually by changing the admin password

## Self-Hosting

### GitHub Pages

1. Fork this repository
2. Enable GitHub Pages in Settings - Pages - Source: GitHub Actions
3. Update `base` in `vite.config.ts` to match your repo name
4. Push changes - automatic deployment via GitHub Actions

### Other Hosting

```bash
npm install
npm run build
# Deploy contents of dist/ folder
```

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run typecheck    # Run TypeScript checks
```

## FAQ

**Q: What if a member forgets their code?**
A: Generate new codes with the same password and distribute a new one.

**Q: Can the verifier identify a member from the code?**
A: No. Simple codes are just cryptographic proofs, not identifiers.

**Q: How often should codes be renewed?**
A: Annually recommended. Change the admin password at the start of each season.

**Q: What if we have more than 1000 members?**
A: Use multiple Club IDs, e.g., `CLUB-ADULTS` and `CLUB-JUNIORS`.

**Q: Does it work offline?**
A: Yes, once the page is loaded. All computation happens in the browser.

## License

MIT
