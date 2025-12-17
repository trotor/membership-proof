/**
 * Cryptographic core for membership proof system.
 * Uses Web Crypto API for HMAC-SHA256 and PBKDF2.
 *
 * All operations happen client-side - no personal data leaves the browser.
 */

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT = 'membership-proof-key-derivation-v2';

/**
 * 6-DIGIT CODE FORMAT
 *
 * Format: RRRSSS (e.g., "847291")
 * - RRR: 3-digit random identifier (000-999)
 * - SSS: 3-digit signature derived from HMAC
 *
 * Security properties:
 * - 1000 unique codes per club (enough for most sports clubs)
 * - Forgery without key: 1/1000 probability per attempt
 * - No personal data in code
 * - Club ID bound cryptographically (wrong club = invalid)
 */

// Base64URL encoding/decoding (URL-safe, no padding)
export function toBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function fromBase64Url(str: string): Uint8Array {
  const padded = str + '==='.slice(0, (4 - (str.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Derive club key from admin password using PBKDF2
export async function deriveClubKey(
  adminPassword: string,
  clubId: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(adminPassword);
  const saltBuffer = encoder.encode(`${PBKDF2_SALT}:${clubId.toUpperCase()}`);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
}

// Export club key to base64url string
export async function exportClubKey(key: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return toBase64Url(rawKey);
}

// Import club key from base64url string
export async function importClubKey(keyString: string): Promise<CryptoKey> {
  const keyBytes = fromBase64Url(keyString);
  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// Compute 3-digit signature for a given identifier
async function computeSignature(
  clubKey: CryptoKey,
  clubId: string,
  identifier: number
): Promise<number> {
  const encoder = new TextEncoder();
  const message = encoder.encode(`${clubId.toUpperCase()}|${identifier.toString().padStart(3, '0')}`);

  const signature = await crypto.subtle.sign('HMAC', clubKey, message.buffer as ArrayBuffer);
  const view = new DataView(signature);

  // Use first 4 bytes to get a number, then mod 1000
  const num = view.getUint32(0, false);
  return num % 1000;
}

// Generate a single 6-digit member code
export async function generateMemberCode(
  clubKey: CryptoKey,
  clubId: string,
  _expiryDate: Date | null // Kept for API compatibility, not used
): Promise<string> {
  // Random 3-digit identifier (000-999)
  const identifier = Math.floor(Math.random() * 1000);

  // Compute 3-digit signature
  const sig = await computeSignature(clubKey, clubId, identifier);

  // Format: RRRSSS
  const code = identifier.toString().padStart(3, '0') + sig.toString().padStart(3, '0');
  return code;
}

// Verification result
export interface VerificationResult {
  valid: boolean;
  reason?: 'invalid_format' | 'invalid_code';
}

// Verify a 6-digit member code
export async function verifyMemberCode(
  code: string,
  clubKey: CryptoKey,
  clubId: string
): Promise<VerificationResult> {
  // Clean the code (remove spaces, dashes)
  const cleanCode = code.replace(/[\s-]/g, '');

  // Must be exactly 6 digits
  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false, reason: 'invalid_format' };
  }

  // Parse identifier and signature
  const identifier = parseInt(cleanCode.slice(0, 3), 10);
  const providedSig = parseInt(cleanCode.slice(3, 6), 10);

  // Compute expected signature
  const expectedSig = await computeSignature(clubKey, clubId, identifier);

  if (providedSig !== expectedSig) {
    return { valid: false, reason: 'invalid_code' };
  }

  return { valid: true };
}

// Parse a code (for format checking)
export function parseMemberCode(code: string): { valid: boolean } | null {
  const cleanCode = code.replace(/[\s-]/g, '');
  if (/^\d{6}$/.test(cleanCode)) {
    return { valid: true };
  }
  return null;
}

// Parse CSV content
export function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  });
}

// Generate unique codes for multiple members
export async function generateCodesFromCSV(
  csvContent: string,
  adminPassword: string,
  clubId: string,
  expiryDate: Date | null
): Promise<{ clubKey: string; codes: string[] }> {
  const rows = parseCSV(csvContent);

  const startIndex = rows.length > 0 &&
    rows[0].some(cell => /^(name|member|id|email)/i.test(cell)) ? 1 : 0;

  const clubKey = await deriveClubKey(adminPassword, clubId);
  const exportedKey = await exportClubKey(clubKey);

  const codes: string[] = [];
  const usedIdentifiers = new Set<number>();

  for (let i = startIndex; i < rows.length; i++) {
    if (rows[i].length > 0 && rows[i][0]) {
      // Generate unique identifier
      let identifier: number;
      let attempts = 0;
      do {
        identifier = Math.floor(Math.random() * 1000);
        attempts++;
        if (attempts > 2000) {
          throw new Error('Too many members - maximum 1000 codes per club');
        }
      } while (usedIdentifiers.has(identifier));

      usedIdentifiers.add(identifier);

      // Compute signature
      const sig = await computeSignature(clubKey, clubId, identifier);
      const code = identifier.toString().padStart(3, '0') + sig.toString().padStart(3, '0');
      codes.push(code);
    }
  }

  return { clubKey: exportedKey, codes };
}
