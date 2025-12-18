# Membership Proof

Privacy-preserving membership verification for sports clubs and non-profits.

**[Try the live demo](https://trotor.github.io/membership-proof/)**

## Why This App?

### The Problem

Sports clubs, associations, and non-profits often need to verify membership at events, competitions, or facilities. Traditional solutions have significant drawbacks:

- **Paper membership cards** are easy to forge, lose, or forget
- **Centralized databases** require internet access, raise privacy concerns, and create data breach risks
- **Mobile apps with accounts** add friction and require members to install yet another app
- **Email/SMS verification** needs internet and exposes contact information

### The Solution

Membership Proof provides **cryptographic membership verification** with these key properties:

1. **No personal data stored anywhere** - All processing happens in your browser
2. **Works offline** - Once loaded, no internet needed
3. **No accounts or apps** - Just a code or QR that members keep
4. **Impossible to forge** - Codes are cryptographically signed with your secret key
5. **Privacy by design** - Simple codes reveal nothing about the member

### Use Cases

- **Swimming clubs**: Verify pool access rights at the entrance
- **Sports competitions**: Check competitor eligibility without membership lists
- **Youth organizations**: Verify membership for discounts or access
- **Volunteer organizations**: Confirm active membership status
- **Any group** that needs to verify "is this person a member?" without sharing member lists

## Three Code Systems

| System | Best For | Member Receives | Verification |
|--------|----------|-----------------|--------------|
| **Simple 6-digit** | Quick, anonymous verification | Just a number: `847291` | Enter code |
| **Name + code** | Named verification, easy to remember | Number only: `841410` (they know their name) | Enter `SMITH.841410` |
| **QR codes** | Scan-based verification with name | QR code image | Scan with phone |

## Quick Start

### For Administrators (Generating Codes)

**Simple 6-digit codes:**
1. Enter an Admin Password (keep this secret!)
2. Specify how many codes you need
3. Click "Generate Codes"
4. Share the **Club Key** with verifiers (coaches, officials)
5. Distribute one code to each member

**Name + code system:**
1. Prepare a CSV file with member surnames (one per line)
2. Select "Name + code" system
3. Enter Admin Password
4. Upload the CSV file
5. Share the **Club Key** with verifiers
6. Give each member just their number (they already know their name)

**QR codes with names:**
1. Prepare a CSV file with member surnames
2. Select "QR codes with names"
3. Enter Club ID (shown on QR) and Admin Password
4. Upload the CSV file
5. Share the **Club Key** with verifiers
6. Send each QR code to the respective member

### For Verifiers (Checking Membership)

**Simple codes:**
1. Enter the Club Key (saved automatically after first use)
2. Ask member for their 6-digit code
3. Click "Verify" - shows VALID or INVALID

**Name + code:**
1. Enter the Club Key
2. Ask member to say their name and code
3. Enter as `LASTNAME.123456` (dot between name and code)
4. Click "Verify" - shows VALID MEMBER: NAME

**QR codes:**
1. First time: Enter the Club Key (saved automatically)
2. Scan member's QR code with phone camera
3. Page opens and shows: VALID MEMBER: LASTNAME

## How It Works

### Cryptographic Foundation

All systems use the same cryptographic foundation:

```
Admin Password → PBKDF2 (100,000 iterations) → Club Key
Club Key = HMAC key for signing codes
```

The admin password deterministically generates the club key. Same password = same key = same codes.

### Simple 6-Digit Codes

```
Code format: RRRSSS (e.g., 847291)
  RRR: Random identifier (000-999)
  SSS: HMAC signature mod 1000

Generation: Pick random RRR, compute SSS = HMAC(key, RRR) mod 1000
Verification: HMAC(key, RRR) mod 1000 == SSS
```

- Maximum 1000 unique codes per password
- Forgery probability: 0.1% per random guess
- No personal data in the code

### Name + Code System

```
Code format: LASTNAME.NNNNNN (e.g., SMITH.841410)

Generation: NNNNNN = HMAC(key, "NAME|LASTNAME|index") mod 1000000
Verification: Try indices 0-49 until HMAC matches
```

**Example with password "PASSWORD":**

| CSV Input | Generated Code |
|-----------|----------------|
| John Smith | `SMITH.841410` |
| Jane Smith | `SMITH.026731` |
| Bob Smith | `SMITH.991928` |
| Alice Jones | `JONES.963921` |
| Tom Jones | `JONES.496765` |

**Key features:**
- Each person with the same surname gets a unique code
- The duplicate index is hidden - user doesn't know they're "the second Smith"
- Verification tries all possible indices until match found
- Member only needs to remember the number (they know their name)

### QR Codes with Names

```
QR contains: https://your-site.com/?verify=ENCRYPTED_DATA

ENCRYPTED_DATA = AES-256-GCM(key, {name: "SMITH", index: 5})
```

- Name is encrypted, not just signed
- Only club key holders can decrypt
- Scanning opens verification page automatically

## Security

| Feature | Implementation |
|---------|----------------|
| Key derivation | PBKDF2-SHA256, 100,000 iterations |
| Code signing | HMAC-SHA256 |
| Name encryption | AES-256-GCM with random IV |
| Data storage | None - all client-side, keys in browser localStorage |

### Security Properties

- **Codes cannot be forged** without the admin password
- **Club key is safe to share** with verifiers (it cannot regenerate codes for other names)
- **Wrong password = different codes** - no way to verify someone else's codes
- **No data leaves the browser** - check Network tab to verify

### Trade-offs

This system prioritizes **usability over maximum security**:

- Simple 6-digit codes have 0.1% forgery probability per guess (rate-limit if concerned)
- Suitable for sports clubs and community organizations
- **Not recommended** for high-security applications (building access, payments)
- Regenerate codes annually by changing the admin password

## Self-Hosting

### GitHub Pages (Recommended)

1. Fork this repository
2. Enable GitHub Pages: Settings → Pages → Source: GitHub Actions
3. Update `base` in `vite.config.ts` to match your repo name
4. Push changes - automatic deployment via GitHub Actions

### Other Hosting

```bash
npm install
npm run build
# Deploy contents of dist/ folder to any static hosting
```

Works on: GitHub Pages, Netlify, Vercel, AWS S3, any web server.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at localhost:5173
npm run build        # Build for production
npm run typecheck    # Run TypeScript type checks
```

## FAQ

**Q: What if a member forgets their code?**
A: For simple codes, give them a new one from your list. For name+code, regenerate with same password - they'll get the same code.

**Q: Can the verifier identify a member from a simple code?**
A: No. Simple codes are cryptographic proofs, not identifiers. They prove membership without revealing identity.

**Q: How often should codes be renewed?**
A: Annually recommended. Change the admin password at the start of each season.

**Q: What if we have more than 1000 members?**
A: Use name+code system (unlimited) or QR codes. Simple codes are limited to 1000.

**Q: Does it work offline?**
A: Yes, once the page is loaded. All computation happens in the browser.

**Q: Is the club key secret?**
A: It should be shared only with authorized verifiers. It cannot generate new codes, but it can verify all existing codes.

**Q: What if the club key leaks?**
A: Change the admin password to generate new codes and a new club key. Old codes become invalid.

## Calculation Examples

### Complete Workflow Example

**Step 1: Admin generates codes**
```
Password: "PASSWORD"
CSV file:
  name
  John Smith
  Jane Smith
  Alice Jones
```

**Step 2: System derives club key**
```
Club Key = PBKDF2(password="PASSWORD", salt="membership-proof-key-derivation-v2:MEMBERSHIP-CODES-V1", iterations=100000)
         = EOOe1zGPlsCkJE6wdW5COwyCWP-XBQ1mZ5ih9bDOtWuzKI0I_MJ_UfEtyZV9IzKV9kOVqtFletQd9Be7Cnvfqg
```

**Step 3: System generates codes**
```
For "John Smith" (surname=SMITH, index=0):
  Signature = HMAC-SHA256(key, "NAME|SMITH|0")
  Code = first_4_bytes(Signature) mod 1000000 = 841410
  Output: SMITH.841410

For "Jane Smith" (surname=SMITH, index=1):
  Signature = HMAC-SHA256(key, "NAME|SMITH|1")
  Code = first_4_bytes(Signature) mod 1000000 = 026731
  Output: SMITH.026731

For "Alice Jones" (surname=JONES, index=0):
  Signature = HMAC-SHA256(key, "NAME|JONES|0")
  Code = first_4_bytes(Signature) mod 1000000 = 963921
  Output: JONES.963921
```

**Step 4: Admin distributes**
- Gives John Smith: "Your code is 841410"
- Gives Jane Smith: "Your code is 026731"
- Gives Alice Jones: "Your code is 963921"
- Shares Club Key with verifiers

**Step 5: Verification**
```
Member says: "Smith, 841410"
Verifier enters: SMITH.841410

System tries:
  HMAC(key, "NAME|SMITH|0") mod 1000000 = 841410 ✓ MATCH!

Result: ✅ VALID MEMBER: SMITH
```

### Why Duplicate Names Work

Each surname occurrence gets a different index:

```
CSV:                Generated:
  VIRTANEN     →    VIRTANEN.809199  (index 0)
  KORHONEN     →    KORHONEN.733133  (index 0)
  VIRTANEN     →    VIRTANEN.384521  (index 1)  ← Different code!
  VIRTANEN     →    VIRTANEN.192847  (index 2)  ← Different code!
```

The user never sees the index - they just get their unique 6-digit code.

## License

MIT
