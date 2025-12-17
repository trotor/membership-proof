# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A privacy-preserving membership verification system using simple 6-digit codes. Designed for sports clubs and non-profits who need to verify membership without storing personal data.

## Architecture

- **Client-side only**: All processing happens in the browser
- **HMAC-SHA256**: 6-digit codes derived from HMAC signatures
- **PBKDF2**: Admin password derives club key (100,000 iterations)
- **No server**: Static files only, maximum privacy

## Key Files

- `src/crypto.ts` - Cryptographic operations (HMAC, PBKDF2, code generation/verification)
- `src/main.ts` - UI logic and form handling
- `index.html` - Single-page web interface with embedded CSS

## Development Commands

```bash
npm install       # Install dependencies
npm run dev       # Start development server (Vite)
npm run build     # Build for production
npm run typecheck # Type-check TypeScript
```

## Code Format

**6-digit numeric code**: `847291`

Structure:
- First 3 digits (000-999): Random identifier
- Last 3 digits: HMAC-derived signature

Verification: `HMAC(key, club_id + identifier) mod 1000 == signature`

## Limitations

- Maximum 1000 unique codes per club ID
- Forgery probability: 0.1% per attempt (acceptable for low-security use)
- Use multiple club IDs for larger organizations

## Security Trade-offs

This system prioritizes **usability over cryptographic strength**:
- 6-digit codes are memorable but less secure than longer tokens
- Acceptable for sports clubs, not for high-security applications
- Regenerate codes annually by changing admin password
