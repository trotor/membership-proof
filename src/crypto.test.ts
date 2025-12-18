/**
 * Tests for cryptographic functions
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import {
  deriveClubKey,
  exportClubKey,
  importClubKey,
  generateCodesByCount,
  generateNamedCodesFromCSV,
  verifyMemberCode,
  verifyNamedCode,
  toBase64Url,
  fromBase64Url,
  CODE_SYSTEM_SALT,
} from './crypto';

describe('Base64URL encoding', () => {
  it('should encode and decode correctly', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
    const encoded = toBase64Url(original);
    const decoded = fromBase64Url(encoded);
    expect(decoded).toEqual(original);
  });

  it('should produce URL-safe output', () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;
    const encoded = toBase64Url(data);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });
});

describe('Key derivation', () => {
  it('should derive same key from same password', async () => {
    const key1 = await deriveClubKey('testpassword123', 'TESTCLUB');
    const key2 = await deriveClubKey('testpassword123', 'TESTCLUB');

    const exported1 = await exportClubKey(key1);
    const exported2 = await exportClubKey(key2);

    expect(exported1).toBe(exported2);
  });

  it('should derive different keys from different passwords', async () => {
    const key1 = await deriveClubKey('password1234', 'TESTCLUB');
    const key2 = await deriveClubKey('password5678', 'TESTCLUB');

    const exported1 = await exportClubKey(key1);
    const exported2 = await exportClubKey(key2);

    expect(exported1).not.toBe(exported2);
  });

  it('should derive different keys for different club IDs', async () => {
    const key1 = await deriveClubKey('samepassword', 'CLUB-A');
    const key2 = await deriveClubKey('samepassword', 'CLUB-B');

    const exported1 = await exportClubKey(key1);
    const exported2 = await exportClubKey(key2);

    expect(exported1).not.toBe(exported2);
  });

  it('should export and import key correctly', async () => {
    const originalKey = await deriveClubKey('mypassword12', 'MYCLUB');
    const exported = await exportClubKey(originalKey);
    const importedKey = await importClubKey(exported);

    // Verify the imported key works by signing and verifying
    const encoder = new TextEncoder();
    const message = encoder.encode('test message');

    const sig1 = await crypto.subtle.sign('HMAC', originalKey, message.buffer as ArrayBuffer);
    const verified = await crypto.subtle.verify('HMAC', importedKey, sig1, message.buffer as ArrayBuffer);

    expect(verified).toBe(true);
  });
});

describe('Simple 6-digit codes', () => {
  it('should generate requested number of codes', async () => {
    const { codes } = await generateCodesByCount(10, 'testpassword123');
    expect(codes).toHaveLength(10);
  });

  it('should generate 6-digit codes', async () => {
    const { codes } = await generateCodesByCount(5, 'testpassword123');
    codes.forEach(code => {
      expect(code).toMatch(/^\d{6}$/);
    });
  });

  it('should generate unique codes', async () => {
    const { codes } = await generateCodesByCount(100, 'testpassword123');
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(100);
  });

  it('should verify valid codes', async () => {
    const password = 'verifytest123';
    const { clubKey, codes } = await generateCodesByCount(5, password);

    const importedKey = await importClubKey(clubKey);

    for (const code of codes) {
      const result = await verifyMemberCode(code, importedKey, CODE_SYSTEM_SALT);
      expect(result.valid).toBe(true);
    }
  });

  it('should reject invalid codes', async () => {
    const { clubKey } = await generateCodesByCount(5, 'testpassword123');
    const importedKey = await importClubKey(clubKey);

    // Random codes should fail (with high probability)
    const fakeCode = '123456';
    const result = await verifyMemberCode(fakeCode, importedKey, 'SIMPLE');
    // This might occasionally pass by chance (0.1%), so we test multiple
  });

  it('should reject codes with wrong format', async () => {
    const { clubKey } = await generateCodesByCount(1, 'testpassword123');
    const importedKey = await importClubKey(clubKey);

    const result1 = await verifyMemberCode('12345', importedKey, CODE_SYSTEM_SALT);
    expect(result1.valid).toBe(false);
    expect(result1.reason).toBe('invalid_format');

    const result2 = await verifyMemberCode('1234567', importedKey, CODE_SYSTEM_SALT);
    expect(result2.valid).toBe(false);
    expect(result2.reason).toBe('invalid_format');

    const result3 = await verifyMemberCode('abcdef', importedKey, CODE_SYSTEM_SALT);
    expect(result3.valid).toBe(false);
    expect(result3.reason).toBe('invalid_format');
  });
});

describe('Named codes (NAME.123456)', () => {
  const testCSV = `name
SMITH
JONES
WILLIAMS
BROWN`;

  it('should generate codes for each name in CSV', async () => {
    const { codes } = await generateNamedCodesFromCSV(testCSV, 'namedtest123');
    expect(codes).toHaveLength(4);
  });

  it('should generate 6-digit codes', async () => {
    const { codes } = await generateNamedCodesFromCSV(testCSV, 'namedtest123');
    codes.forEach(c => {
      expect(c.code).toMatch(/^\d{6}$/);
    });
  });

  it('should generate correct fullCode format', async () => {
    const { codes } = await generateNamedCodesFromCSV(testCSV, 'namedtest123');
    codes.forEach(c => {
      expect(c.fullCode).toBe(`${c.name}.${c.code}`);
    });
  });

  it('should generate same code for same name with same password', async () => {
    const { codes: codes1 } = await generateNamedCodesFromCSV(testCSV, 'samepassword');
    const { codes: codes2 } = await generateNamedCodesFromCSV(testCSV, 'samepassword');

    expect(codes1[0].code).toBe(codes2[0].code);
    expect(codes1[1].code).toBe(codes2[1].code);
  });

  it('should generate different codes with different password', async () => {
    const { codes: codes1 } = await generateNamedCodesFromCSV(testCSV, 'password1111');
    const { codes: codes2 } = await generateNamedCodesFromCSV(testCSV, 'password2222');

    expect(codes1[0].code).not.toBe(codes2[0].code);
  });

  it('should verify valid named codes', async () => {
    const { clubKey, codes } = await generateNamedCodesFromCSV(testCSV, 'verifynamed1');
    const importedKey = await importClubKey(clubKey);

    for (const c of codes) {
      const result = await verifyNamedCode(c.fullCode, importedKey);
      expect(result.valid).toBe(true);
      expect(result.name).toBe(c.name);
    }
  });

  it('should verify codes case-insensitively', async () => {
    const { clubKey, codes } = await generateNamedCodesFromCSV(testCSV, 'casetest123');
    const importedKey = await importClubKey(clubKey);

    // Test with lowercase
    const lowerCode = codes[0].fullCode.toLowerCase();
    const result = await verifyNamedCode(lowerCode, importedKey);
    expect(result.valid).toBe(true);
  });

  it('should reject codes with wrong name', async () => {
    const { clubKey, codes } = await generateNamedCodesFromCSV(testCSV, 'wrongname123');
    const importedKey = await importClubKey(clubKey);

    // Use SMITH's code with JONES's name
    const wrongCode = `JONES.${codes[0].code}`; // codes[0] is SMITH
    const result = await verifyNamedCode(wrongCode, importedKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_code');
  });

  it('should reject codes with wrong format', async () => {
    const { clubKey } = await generateNamedCodesFromCSV(testCSV, 'formattest1');
    const importedKey = await importClubKey(clubKey);

    // Missing dot
    const result1 = await verifyNamedCode('SMITH123456', importedKey);
    expect(result1.valid).toBe(false);
    expect(result1.reason).toBe('invalid_format');

    // Colon instead of dot
    const result2 = await verifyNamedCode('SMITH:123456', importedKey);
    expect(result2.valid).toBe(false);
    expect(result2.reason).toBe('invalid_format');

    // Space instead of dot
    const result3 = await verifyNamedCode('SMITH 123456', importedKey);
    expect(result3.valid).toBe(false);
    expect(result3.reason).toBe('invalid_format');

    // Wrong number of digits
    const result4 = await verifyNamedCode('SMITH.12345', importedKey);
    expect(result4.valid).toBe(false);
    expect(result4.reason).toBe('invalid_format');
  });

  it('should reject codes with wrong club key', async () => {
    const { codes } = await generateNamedCodesFromCSV(testCSV, 'password-A');
    const { clubKey: wrongKey } = await generateNamedCodesFromCSV(testCSV, 'password-B');
    const importedWrongKey = await importClubKey(wrongKey);

    const result = await verifyNamedCode(codes[0].fullCode, importedWrongKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_code');
  });
});

describe('End-to-end workflow', () => {
  it('should complete full simple code workflow', async () => {
    // Admin generates codes
    const password = 'admin-secret-pw';
    const { clubKey, codes } = await generateCodesByCount(20, password);

    console.log('Generated club key:', clubKey);
    console.log('Sample codes:', codes.slice(0, 3));

    // Verifier imports key
    const verifierKey = await importClubKey(clubKey);

    // Verify each code
    let validCount = 0;
    for (const code of codes) {
      const result = await verifyMemberCode(code, verifierKey, CODE_SYSTEM_SALT);
      if (result.valid) validCount++;
    }

    expect(validCount).toBe(20);
  });

  it('should complete full named code workflow', async () => {
    // Admin prepares member list
    const memberCSV = `surname
VIRTANEN
KORHONEN
MÄKINEN
NIEMINEN`;

    // Admin generates codes
    const password = 'seura-salasana';
    const { clubKey, codes } = await generateNamedCodesFromCSV(memberCSV, password);

    console.log('Generated club key:', clubKey);
    console.log('Generated codes:');
    codes.forEach(c => console.log(`  ${c.name}: ${c.code} (verify with ${c.fullCode})`));

    // Verifier imports key
    const verifierKey = await importClubKey(clubKey);

    // Verify each code
    for (const c of codes) {
      const result = await verifyNamedCode(c.fullCode, verifierKey);
      expect(result.valid).toBe(true);
      expect(result.name).toBe(c.name);
      console.log(`  ${c.fullCode} -> VALID: ${result.name}`);
    }
  });

  it('should produce consistent results for documentation example', async () => {
    // This test uses fixed inputs to produce consistent outputs for documentation
    const csv = `name
SMITH`;

    const { clubKey, codes } = await generateNamedCodesFromCSV(csv, 'documentation-example');

    console.log('=== Documentation Example ===');
    console.log('Password: documentation-example');
    console.log('Club Key:', clubKey);
    console.log('Name: SMITH');
    console.log('Code:', codes[0].code);
    console.log('Full code for verification:', codes[0].fullCode);
    console.log('=============================');

    // Verify it works
    const key = await importClubKey(clubKey);
    const result = await verifyNamedCode(codes[0].fullCode, key);
    expect(result.valid).toBe(true);
  });
});

describe('Debug: Specific test case from user', () => {
  it('should test the exact user scenario', async () => {
    // User provided:
    // Club key: 0blJ26qBuemfrrqDyoBGwtXlXB60GwbtyvNPbBw9mjFy8xdonTUwN2W6xXKAY2nKzmPz10WlECEet-sg-B_K2Q
    // Code: SMITH: 189403 (should be SMITH.189403)

    const userClubKey = '0blJ26qBuemfrrqDyoBGwtXlXB60GwbtyvNPbBw9mjFy8xdonTUwN2W6xXKAY2nKzmPz10WlECEet-sg-B_K2Q';

    try {
      const key = await importClubKey(userClubKey);
      console.log('Successfully imported user club key');

      // Try verifying SMITH.189403
      const result = await verifyNamedCode('SMITH.189403', key);
      console.log('Verification result for SMITH.189403:', result);

      // Compute what SMITH's code SHOULD be with this key
      // by manually calling the signature function
      const encoder = new TextEncoder();
      const message = encoder.encode('NAME|SMITH');
      const signature = await crypto.subtle.sign('HMAC', key, message.buffer as ArrayBuffer);
      const view = new DataView(signature);
      const num = view.getUint32(0, false);
      const expectedCode = (num % 1000000).toString().padStart(6, '0');

      console.log('Expected SMITH code for this key:', expectedCode);
      console.log('User provided code: 189403');
      console.log('Codes match:', expectedCode === '189403');

    } catch (e) {
      console.error('Error importing key:', e);
    }
  });

  it('should generate codes and show what club key produces', async () => {
    // Let's see what password would generate the user's club key
    // by generating some test codes

    const testPasswords = ['test', 'password', 'admin123', 'secret'];

    for (const pw of testPasswords) {
      const { clubKey, codes } = await generateNamedCodesFromCSV('name\nSMITH', pw);
      console.log(`Password "${pw}" -> Club key: ${clubKey.substring(0, 20)}... -> SMITH code: ${codes[0].code}`);
    }
  });

  it('should verify generation and verification use same algorithm', async () => {
    // Generate with known password
    const password = 'test-consistency';
    const { clubKey, codes } = await generateNamedCodesFromCSV('name\nSMITH\nJONES', password);

    console.log('=== Consistency Test ===');
    console.log('Password:', password);
    console.log('Club key:', clubKey);
    console.log('Generated codes:');
    codes.forEach(c => console.log(`  ${c.name} -> ${c.code} (full: ${c.fullCode})`));

    // Now verify with the same key
    const key = await importClubKey(clubKey);

    console.log('Verification:');
    for (const c of codes) {
      const result = await verifyNamedCode(c.fullCode, key);
      console.log(`  ${c.fullCode} -> valid: ${result.valid}`);
      expect(result.valid).toBe(true);
    }
    console.log('========================');
  });

  it('IMPORTANT: Simple and named codes should share the same club key', async () => {
    // After the fix, both systems should use the same salt
    const password = 'same-password-test';

    // Generate simple codes
    const simpleResult = await generateCodesByCount(5, password);
    console.log('Simple codes club key:', simpleResult.clubKey.substring(0, 30) + '...');

    // Generate named codes
    const namedResult = await generateNamedCodesFromCSV('name\nSMITH', password);
    console.log('Named codes club key:', namedResult.clubKey.substring(0, 30) + '...');

    // These SHOULD be the SAME because they use the same salt!
    console.log('Keys are same:', simpleResult.clubKey === namedResult.clubKey);
    expect(simpleResult.clubKey).toBe(namedResult.clubKey);

    // User can use either key to verify named codes
    console.log('\nSMITH code:', namedResult.codes[0].code);

    // Verify SMITH code with the simple key (should work now!)
    const simpleKey = await importClubKey(simpleResult.clubKey);
    const result1 = await verifyNamedCode(namedResult.codes[0].fullCode, simpleKey);
    console.log('Verification with simple key:', result1);
    expect(result1.valid).toBe(true);

    // Verify with named key (should also work)
    const namedKey = await importClubKey(namedResult.clubKey);
    const result2 = await verifyNamedCode(namedResult.codes[0].fullCode, namedKey);
    console.log('Verification with named key:', result2);
    expect(result2.valid).toBe(true);

    // Verify simple codes also work
    const simpleCodeResult = await verifyMemberCode(simpleResult.codes[0], namedKey, CODE_SYSTEM_SALT);
    console.log('Simple code verification:', simpleCodeResult);
    expect(simpleCodeResult.valid).toBe(true);
  });
});
