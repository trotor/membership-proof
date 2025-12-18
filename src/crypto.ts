/**
 * Cryptographic core for membership proof system.
 * Uses Web Crypto API for HMAC-SHA256 and PBKDF2.
 *
 * All operations happen client-side - no personal data leaves the browser.
 */

import QRCode from 'qrcode';

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

// QR code verification result (with name)
export interface QRVerificationResult {
  valid: boolean;
  name?: string;
  index?: number;
  reason?: 'invalid_format' | 'invalid_key' | 'decryption_failed';
}

// Derive AES key from club key for encryption
async function deriveAESKey(clubKey: CryptoKey): Promise<CryptoKey> {
  // Export HMAC key and use it to derive AES key
  const rawKey = await crypto.subtle.exportKey('raw', clubKey);

  // Use first 32 bytes for AES-256
  return crypto.subtle.importKey(
    'raw',
    rawKey.slice(0, 32),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt member data for QR code
export async function encryptMemberData(
  clubKey: CryptoKey,
  name: string,
  index: number
): Promise<string> {
  const aesKey = await deriveAESKey(clubKey);
  const encoder = new TextEncoder();

  const data = JSON.stringify({ name: name.toUpperCase(), idx: index });
  const plaintext = encoder.encode(data);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return toBase64Url(combined);
}

// Decrypt member data from QR code
export async function decryptMemberData(
  clubKey: CryptoKey,
  encryptedData: string
): Promise<QRVerificationResult> {
  try {
    const aesKey = await deriveAESKey(clubKey);
    const combined = fromBase64Url(encryptedData);

    if (combined.length < 13) {
      return { valid: false, reason: 'invalid_format' };
    }

    // Extract IV (first 12 bytes) and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    const data = JSON.parse(decoder.decode(plaintext));

    return {
      valid: true,
      name: data.name,
      index: data.idx
    };
  } catch {
    return { valid: false, reason: 'decryption_failed' };
  }
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

// Fixed salt for all non-QR code systems
// This ensures simple codes and named codes share the same club key
export const CODE_SYSTEM_SALT = 'MEMBERSHIP-CODES-V1';

// Generate unique codes by count (for simple 6-digit system)
export async function generateCodesByCount(
  count: number,
  adminPassword: string
): Promise<{ clubKey: string; codes: string[] }> {
  if (count < 1 || count > 1000) {
    throw new Error('Count must be between 1 and 1000');
  }

  // Use shared salt - simple and named codes use same key
  const clubKey = await deriveClubKey(adminPassword, CODE_SYSTEM_SALT);
  const exportedKey = await exportClubKey(clubKey);

  const codes: string[] = [];
  const usedIdentifiers = new Set<number>();

  for (let i = 0; i < count; i++) {
    // Generate unique identifier
    let identifier: number;
    let attempts = 0;
    do {
      identifier = Math.floor(Math.random() * 1000);
      attempts++;
      if (attempts > 2000) {
        throw new Error('Too many codes - maximum 1000 per club');
      }
    } while (usedIdentifiers.has(identifier));

    usedIdentifiers.add(identifier);

    // Compute signature
    const sig = await computeSignature(clubKey, CODE_SYSTEM_SALT, identifier);
    const code = identifier.toString().padStart(3, '0') + sig.toString().padStart(3, '0');
    codes.push(code);
  }

  return { clubKey: exportedKey, codes };
}

// Code system type
export type CodeSystem = 'simple' | 'named' | 'qr';

// Named code result
export interface NamedCodeResult {
  name: string;
  code: string;  // Just the 6 digits
  fullCode: string;  // NAME.123456 format
}

// Compute 6-digit signature for a name with index (club key already unique per organization)
async function computeNameSignature(
  clubKey: CryptoKey,
  name: string,
  index: number = 0
): Promise<number> {
  const encoder = new TextEncoder();
  const normalizedName = name.toUpperCase().trim();
  // Include index in signature to make duplicate names unique
  const message = encoder.encode(`NAME|${normalizedName}|${index}`);

  const signature = await crypto.subtle.sign('HMAC', clubKey, message.buffer as ArrayBuffer);
  const view = new DataView(signature);

  // Use first 4 bytes to get a number, then mod 1000000 for 6 digits
  const num = view.getUint32(0, false);
  return num % 1000000;
}

// Generate named codes from CSV (no club ID needed - password makes key unique)
export async function generateNamedCodesFromCSV(
  csvContent: string,
  adminPassword: string
): Promise<{ clubKey: string; codes: NamedCodeResult[] }> {
  const rows = parseCSV(csvContent);

  // Skip header if present
  const startIndex = rows.length > 0 &&
    rows[0].some(cell => /^(name|member|id|email|nimi|sukunimi|surname)/i.test(cell)) ? 1 : 0;

  // Use shared salt - simple and named codes use same key
  const clubKey = await deriveClubKey(adminPassword, CODE_SYSTEM_SALT);
  const exportedKey = await exportClubKey(clubKey);

  const codes: NamedCodeResult[] = [];
  const surnameCount: Map<string, number> = new Map();

  for (let i = startIndex; i < rows.length; i++) {
    if (rows[i].length > 0 && rows[i][0]) {
      const fullName = rows[i][0].trim().toUpperCase();
      // Extract surname (last word) from full name
      const nameParts = fullName.split(/\s+/);
      const surname = nameParts[nameParts.length - 1];

      // Track how many times we've seen this surname
      const count = surnameCount.get(surname) || 0;
      surnameCount.set(surname, count + 1);

      // Compute signature with index for uniqueness
      const sig = await computeNameSignature(clubKey, surname, count);
      const numCode = sig.toString().padStart(6, '0');

      // Add hidden index as letter suffix (A=first, B=second, etc.)
      const indexLetter = String.fromCharCode(65 + count); // A, B, C, ...
      const code = `${numCode}${indexLetter}`;

      codes.push({
        name: surname,
        code,
        fullCode: `${surname}.${code}`
      });
    }
  }

  return { clubKey: exportedKey, codes };
}

// Verify a named code (NAME.123456 format)
export interface NamedVerificationResult {
  valid: boolean;
  name?: string;
  reason?: 'invalid_format' | 'invalid_code';
}

export async function verifyNamedCode(
  input: string,
  clubKey: CryptoKey
): Promise<NamedVerificationResult> {
  // Parse NAME.123456X format (6 digits + letter suffix for index)
  const match = input.match(/^([A-Za-z\u00C0-\u017F][A-Za-z\u00C0-\u017F\s\-]*)\.(\d{6})([A-Za-z])$/);
  if (!match) {
    return { valid: false, reason: 'invalid_format' };
  }

  // Extract surname (last word from name)
  const fullName = match[1].toUpperCase().trim();
  const nameParts = fullName.split(/\s+/);
  const surname = nameParts[nameParts.length - 1];

  // Extract index from letter suffix (A=0, B=1, C=2, ...)
  const indexLetter = match[3].toUpperCase();
  const index = indexLetter.charCodeAt(0) - 65; // A=0, B=1, etc.

  const providedCode = parseInt(match[2], 10);

  // Compute expected code with index
  const expectedCode = await computeNameSignature(clubKey, surname, index);

  if (providedCode !== expectedCode) {
    return { valid: false, reason: 'invalid_code' };
  }

  // Return just the surname (user doesn't need to know their index)
  return { valid: true, name: surname };
}

// QR code result
export interface QRCodeResult {
  name: string;
  index: number;
  verifyUrl: string;
  qrDataUrl: string;
}

// Generate QR codes with encrypted names
export async function generateQRCodesFromCSV(
  csvContent: string,
  adminPassword: string,
  clubId: string,
  baseUrl: string
): Promise<{ clubKey: string; qrCodes: QRCodeResult[] }> {
  const rows = parseCSV(csvContent);

  // Skip header if present
  const startIndex = rows.length > 0 &&
    rows[0].some(cell => /^(name|member|id|email|nimi|sukunimi)/i.test(cell)) ? 1 : 0;

  const clubKey = await deriveClubKey(adminPassword, clubId);
  const exportedKey = await exportClubKey(clubKey);

  const qrCodes: QRCodeResult[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    if (rows[i].length > 0 && rows[i][0]) {
      // Get name (first column, assume it's surname)
      const name = rows[i][0].trim();
      const index = i - startIndex + 1;

      // Encrypt the member data
      const encryptedData = await encryptMemberData(clubKey, name, index);

      // Create verification URL
      const verifyUrl = `${baseUrl}?verify=${encryptedData}`;

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'M'
      });

      qrCodes.push({
        name,
        index,
        verifyUrl,
        qrDataUrl
      });
    }
  }

  return { clubKey: exportedKey, qrCodes };
}
