/**
 * UI Test - Generate known values for manual UI testing
 */

import { readFileSync } from 'fs';
import {
  generateNamedCodesFromCSV,
  verifyNamedCode,
  importClubKey,
} from './crypto';

async function testWithCSV(name: string, csvPath: string, password: string) {
  console.log('==========================================');
  console.log(`TEST: ${name}`);
  console.log('==========================================\n');

  const csv = readFileSync(csvPath, 'utf-8');

  console.log('INPUT:');
  console.log('  File:', csvPath);
  console.log('  Password:', password);
  console.log('  CSV content:');
  csv.split('\n').slice(0, 6).forEach(line => console.log('    ' + line));
  if (csv.split('\n').length > 6) console.log('    ...');
  console.log('');

  // Generate
  const { clubKey, codes } = await generateNamedCodesFromCSV(csv, password);

  console.log('OUTPUT:');
  console.log('  Club Key:', clubKey);
  console.log('');
  console.log('  Codes:');
  codes.forEach(c => {
    console.log(`    ${c.fullCode}`);
  });
  console.log('');

  // Verify
  console.log('VERIFICATION:');
  const key = await importClubKey(clubKey);
  let allValid = true;
  for (const c of codes) {
    const result = await verifyNamedCode(c.fullCode, key);
    const status = result.valid ? '✅' : '❌';
    console.log(`    ${c.fullCode} -> ${status}`);
    if (!result.valid) allValid = false;
  }
  console.log('');
  console.log(allValid ? '✅ ALL PASSED' : '❌ SOME FAILED');
  console.log('');

  return { clubKey, codes };
}

async function main() {
  // Test 1: test-members.csv with PASSWORD
  await testWithCSV(
    'test-members.csv + PASSWORD',
    'test/test-members.csv',
    'PASSWORD'
  );

  // Test 2: simple-members.csv with PASSWORD
  await testWithCSV(
    'simple-members.csv + PASSWORD',
    'test/simple-members.csv',
    'PASSWORD'
  );

  // Test 3: example-members.csv with PASSWORD
  await testWithCSV(
    'example-members.csv + PASSWORD',
    'test/example-members.csv',
    'PASSWORD'
  );
}

main().catch(console.error);
