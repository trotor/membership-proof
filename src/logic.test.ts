/**
 * Logic verification test
 *
 * Flow:
 * 1. Admin enters password A
 * 2. A -> B (derive key from password)
 * 3. B + S (surname) -> C (code)
 * 4. Verify: f(S.C, B) = True if valid
 */

import { describe, it, expect } from 'vitest';
import {
  deriveClubKey,
  exportClubKey,
  importClubKey,
  generateNamedCodesFromCSV,
  verifyNamedCode,
  CODE_SYSTEM_SALT,
} from './crypto';

// Step-by-step logic test
describe('Logic verification', () => {
  it('should follow the correct flow: A -> B, B(S) = C, verify(S.C, B) = True', async () => {
    // ============================================
    // STEP 1: Admin enters password A
    // ============================================
    const passwordA = 'kerhon-salainen-salasana';
    console.log('STEP 1: Admin password A =', passwordA);

    // ============================================
    // STEP 2: Derive key B from password A
    // ============================================
    const keyB = await deriveClubKey(passwordA, CODE_SYSTEM_SALT);
    const keyBExported = await exportClubKey(keyB);
    console.log('STEP 2: Key B (first 40 chars) =', keyBExported.substring(0, 40) + '...');

    // ============================================
    // STEP 3: Compute code C from surname S using key B
    // ============================================
    const surnameS = 'VIRTANEN';

    // This is the core computation: HMAC(B, "NAME|S") mod 1000000
    const encoder = new TextEncoder();
    const message = encoder.encode(`NAME|${surnameS}`);
    const signature = await crypto.subtle.sign('HMAC', keyB, message.buffer as ArrayBuffer);
    const view = new DataView(signature);
    const num = view.getUint32(0, false);
    const codeC = (num % 1000000).toString().padStart(6, '0');

    console.log('STEP 3: Surname S =', surnameS);
    console.log('STEP 3: Code C = HMAC(B, "NAME|' + surnameS + '") mod 1000000 =', codeC);
    console.log('STEP 3: Full code S.C =', `${surnameS}.${codeC}`);

    // ============================================
    // STEP 4: Verify - f(S.C, B) should return True
    // ============================================
    // Import key B (simulating verifier receiving the key)
    const verifierKeyB = await importClubKey(keyBExported);

    // Parse S.C
    const fullCode = `${surnameS}.${codeC}`;
    const match = fullCode.match(/^([A-Za-z\u00C0-\u017F]+)\.(\d{6})$/);
    expect(match).not.toBeNull();

    const parsedName = match![1].toUpperCase();
    const parsedCode = parseInt(match![2], 10);

    console.log('STEP 4: Verifying', fullCode);
    console.log('STEP 4: Parsed name =', parsedName);
    console.log('STEP 4: Parsed code =', parsedCode);

    // Recompute expected code using key B
    const verifyMessage = encoder.encode(`NAME|${parsedName}`);
    const verifySignature = await crypto.subtle.sign('HMAC', verifierKeyB, verifyMessage.buffer as ArrayBuffer);
    const verifyView = new DataView(verifySignature);
    const verifyNum = verifyView.getUint32(0, false);
    const expectedCode = verifyNum % 1000000;

    console.log('STEP 4: Expected code (recomputed) =', expectedCode);
    console.log('STEP 4: Provided code =', parsedCode);
    console.log('STEP 4: Match =', expectedCode === parsedCode);

    // THE CRITICAL CHECK
    expect(expectedCode).toBe(parsedCode);
    console.log('\n✅ VERIFICATION PASSED: f(S.C, B) = True');
  });

  it('should fail with wrong name', async () => {
    const passwordA = 'test-password-123';
    const keyB = await deriveClubKey(passwordA, CODE_SYSTEM_SALT);
    const keyBExported = await exportClubKey(keyB);

    // Generate code for SMITH
    const encoder = new TextEncoder();
    const message = encoder.encode('NAME|SMITH');
    const signature = await crypto.subtle.sign('HMAC', keyB, message.buffer as ArrayBuffer);
    const view = new DataView(signature);
    const smithCode = (view.getUint32(0, false) % 1000000).toString().padStart(6, '0');

    console.log('Generated SMITH code:', smithCode);

    // Try to verify with JONES (wrong name)
    const verifierKey = await importClubKey(keyBExported);
    const jonesMessage = encoder.encode('NAME|JONES');
    const jonesSignature = await crypto.subtle.sign('HMAC', verifierKey, jonesMessage.buffer as ArrayBuffer);
    const jonesView = new DataView(jonesSignature);
    const jonesExpected = jonesView.getUint32(0, false) % 1000000;

    console.log('JONES expected code:', jonesExpected);
    console.log('SMITH actual code:', parseInt(smithCode, 10));
    console.log('Match:', jonesExpected === parseInt(smithCode, 10));

    // Should NOT match
    expect(jonesExpected).not.toBe(parseInt(smithCode, 10));
    console.log('\n✅ CORRECTLY REJECTED: Wrong name');
  });

  it('should fail with wrong key', async () => {
    // Generate with password A
    const passwordA = 'password-A';
    const keyA = await deriveClubKey(passwordA, CODE_SYSTEM_SALT);

    const encoder = new TextEncoder();
    const message = encoder.encode('NAME|SMITH');
    const signature = await crypto.subtle.sign('HMAC', keyA, message.buffer as ArrayBuffer);
    const view = new DataView(signature);
    const codeA = (view.getUint32(0, false) % 1000000).toString().padStart(6, '0');

    console.log('Code generated with key A:', codeA);

    // Try to verify with different password B
    const passwordB = 'password-B';
    const keyB = await deriveClubKey(passwordB, CODE_SYSTEM_SALT);

    const verifySignature = await crypto.subtle.sign('HMAC', keyB, message.buffer as ArrayBuffer);
    const verifyView = new DataView(verifySignature);
    const expectedWithB = verifyView.getUint32(0, false) % 1000000;

    console.log('Expected code with key B:', expectedWithB);
    console.log('Match:', expectedWithB === parseInt(codeA, 10));

    // Should NOT match
    expect(expectedWithB).not.toBe(parseInt(codeA, 10));
    console.log('\n✅ CORRECTLY REJECTED: Wrong key');
  });

  it('ACTUAL FUNCTIONS: generateNamedCodesFromCSV + verifyNamedCode', async () => {
    console.log('\n========================================');
    console.log('TESTING ACTUAL FUNCTIONS');
    console.log('========================================\n');

    // Step 1: Admin enters password
    const password = 'testi-salasana-2024';
    console.log('1. Admin password:', password);

    // Step 2: Generate codes from CSV
    const csv = `nimi
VIRTANEN
KORHONEN
SMITH`;

    console.log('2. CSV input:');
    console.log(csv);
    console.log('');

    const { clubKey, codes } = await generateNamedCodesFromCSV(csv, password);

    console.log('3. Generated club key:', clubKey);
    console.log('');
    console.log('4. Generated codes:');
    codes.forEach(c => {
      console.log(`   ${c.name} -> ${c.code} (full: ${c.fullCode})`);
    });
    console.log('');

    // Step 3: Verifier imports key
    const verifierKey = await importClubKey(clubKey);
    console.log('5. Verifier imported key successfully');
    console.log('');

    // Step 4: Verify each code
    console.log('6. Verification results:');
    for (const c of codes) {
      const result = await verifyNamedCode(c.fullCode, verifierKey);
      console.log(`   ${c.fullCode} -> valid: ${result.valid}, name: ${result.name || 'N/A'}`);
      expect(result.valid).toBe(true);
      expect(result.name).toBe(c.name);
    }

    console.log('\n✅ ALL VERIFICATIONS PASSED');
    console.log('========================================\n');
  });

  it('ACTUAL FUNCTIONS: wrong key should fail', async () => {
    console.log('\n========================================');
    console.log('TESTING WRONG KEY REJECTION');
    console.log('========================================\n');

    // Generate with password A
    const passwordA = 'kerho-A-salasana';
    const { clubKey: keyA, codes: codesA } = await generateNamedCodesFromCSV('name\nSMITH', passwordA);

    console.log('1. Generated with password A:', passwordA);
    console.log('   Club key A:', keyA.substring(0, 40) + '...');
    console.log('   SMITH code:', codesA[0].fullCode);

    // Generate different key with password B
    const passwordB = 'kerho-B-salasana';
    const { clubKey: keyB } = await generateNamedCodesFromCSV('name\nSMITH', passwordB);

    console.log('');
    console.log('2. Different password B:', passwordB);
    console.log('   Club key B:', keyB.substring(0, 40) + '...');

    // Try to verify code A with key B
    const wrongKey = await importClubKey(keyB);
    const result = await verifyNamedCode(codesA[0].fullCode, wrongKey);

    console.log('');
    console.log('3. Verify SMITH code (from A) with key B:');
    console.log('   Result:', result);

    expect(result.valid).toBe(false);
    console.log('\n✅ CORRECTLY REJECTED: Wrong key');
    console.log('========================================\n');
  });
});
