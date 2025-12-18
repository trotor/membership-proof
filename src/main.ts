/**
 * Main application entry point.
 * Handles UI interactions for code generation and verification.
 */

import {
  generateCodesFromCSV,
  generateQRCodesFromCSV,
  importClubKey,
  verifyMemberCode,
  decryptMemberData,
  parseMemberCode,
  type CodeSystem,
  type QRCodeResult,
} from './crypto';

// Storage keys
const STORAGE_CLUB_KEY = 'membership-proof-club-key';
const STORAGE_CLUB_ID = 'membership-proof-club-id';

// DOM Elements
const tabGenerate = document.getElementById('tab-generate') as HTMLButtonElement;
const tabVerify = document.getElementById('tab-verify') as HTMLButtonElement;
const generateSection = document.getElementById('generate-section') as HTMLElement;
const verifySection = document.getElementById('verify-section') as HTMLElement;

// Generate form elements
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const csvFileInput = document.getElementById('csv-file') as HTMLInputElement;
const fileNameDisplay = document.getElementById('file-name') as HTMLElement;
const clubIdInput = document.getElementById('club-id') as HTMLInputElement;
const adminPasswordInput = document.getElementById('admin-password') as HTMLInputElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const generateResult = document.getElementById('generate-result') as HTMLElement;
const clubKeyOutput = document.getElementById('club-key-output') as HTMLTextAreaElement;
const codesOutput = document.getElementById('codes-output') as HTMLTextAreaElement;
const downloadCodesBtn = document.getElementById('download-codes-btn') as HTMLButtonElement;
const copyKeyBtn = document.getElementById('copy-key-btn') as HTMLButtonElement;

// Code system elements
const codeSystemRadios = document.querySelectorAll('input[name="code-system"]') as NodeListOf<HTMLInputElement>;
const baseUrlGroup = document.getElementById('base-url-group') as HTMLElement;
const baseUrlInput = document.getElementById('base-url') as HTMLInputElement;
const simpleCodesOutput = document.getElementById('simple-codes-output') as HTMLElement;
const qrCodesOutput = document.getElementById('qr-codes-output') as HTMLElement;
const qrGrid = document.getElementById('qr-grid') as HTMLElement;
const downloadQrBtn = document.getElementById('download-qr-btn') as HTMLButtonElement;

// Verify form elements
const verifyClubKeyInput = document.getElementById('verify-club-key') as HTMLInputElement;
const verifyClubIdInput = document.getElementById('verify-club-id') as HTMLInputElement;
const memberCodeInput = document.getElementById('member-code') as HTMLInputElement;
const verifyBtn = document.getElementById('verify-btn') as HTMLButtonElement;
const verifyResult = document.getElementById('verify-result') as HTMLElement;

// Tab switching
tabGenerate.addEventListener('click', () => {
  tabGenerate.classList.add('active');
  tabVerify.classList.remove('active');
  generateSection.classList.remove('hidden');
  verifySection.classList.add('hidden');
});

tabVerify.addEventListener('click', () => {
  tabVerify.classList.add('active');
  tabGenerate.classList.remove('active');
  verifySection.classList.remove('hidden');
  generateSection.classList.add('hidden');
});

// Code system selection
function getSelectedCodeSystem(): CodeSystem {
  for (const radio of codeSystemRadios) {
    if (radio.checked) return radio.value as CodeSystem;
  }
  return 'simple';
}

codeSystemRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    const system = getSelectedCodeSystem();
    baseUrlGroup.style.display = system === 'qr' ? 'block' : 'none';

    // Auto-fill base URL with current location
    if (system === 'qr' && !baseUrlInput.value) {
      baseUrlInput.value = window.location.origin + window.location.pathname.replace(/\/$/, '');
    }
  });
});

// Drag and drop file handling
function updateFileDisplay(file: File | null) {
  if (file) {
    fileNameDisplay.textContent = `✓ ${file.name}`;
    dropZone.classList.add('has-file');
  } else {
    fileNameDisplay.textContent = '';
    dropZone.classList.remove('has-file');
  }
}

function handleFile(file: File) {
  if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    csvFileInput.files = dataTransfer.files;
    updateFileDisplay(file);
  }
}

dropZone.addEventListener('click', () => {
  csvFileInput.click();
});

csvFileInput.addEventListener('change', () => {
  const file = csvFileInput.files?.[0] || null;
  updateFileDisplay(file);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const file = e.dataTransfer?.files[0];
  if (file) {
    handleFile(file);
  }
});

// Render QR codes grid
function renderQRCodes(qrCodes: QRCodeResult[]) {
  qrGrid.innerHTML = qrCodes.map(qr => `
    <div class="qr-card">
      <img src="${qr.qrDataUrl}" alt="QR code for ${qr.name}">
      <div class="name">${qr.name}</div>
      <div class="index">#${qr.index}</div>
    </div>
  `).join('');
}

// Generate codes
generateBtn.addEventListener('click', async () => {
  const file = csvFileInput.files?.[0];
  const clubId = clubIdInput.value.trim().toUpperCase();
  const adminPassword = adminPasswordInput.value;
  const codeSystem = getSelectedCodeSystem();

  // Validation
  if (!file) {
    showError(generateResult, 'Please select a CSV file');
    return;
  }

  if (!clubId || clubId.length < 2) {
    showError(generateResult, 'Please enter a club ID (at least 2 characters)');
    return;
  }

  if (!/^[A-Z0-9-]+$/.test(clubId)) {
    showError(generateResult, 'Club ID can only contain letters, numbers, and hyphens');
    return;
  }

  if (!adminPassword || adminPassword.length < 8) {
    showError(generateResult, 'Admin password must be at least 8 characters');
    return;
  }

  if (codeSystem === 'qr' && !baseUrlInput.value.trim()) {
    showError(generateResult, 'Please enter the verification URL base for QR codes');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';

  try {
    const csvContent = await file.text();

    if (codeSystem === 'simple') {
      // Simple 6-digit codes
      const { clubKey, codes } = await generateCodesFromCSV(
        csvContent,
        adminPassword,
        clubId,
        null
      );

      clubKeyOutput.value = clubKey;
      codesOutput.value = codes.join('\n');

      generateResult.innerHTML = `
        <div class="success">
          <strong>Generated ${codes.length} member codes</strong>
          <p>Distribute the club key to verifiers. Each member gets one code from the list below.</p>
        </div>
      `;

      simpleCodesOutput.classList.remove('hidden');
      qrCodesOutput.classList.add('hidden');
    } else {
      // QR codes with encrypted names
      const baseUrl = baseUrlInput.value.trim();
      const { clubKey, qrCodes } = await generateQRCodesFromCSV(
        csvContent,
        adminPassword,
        clubId,
        baseUrl
      );

      clubKeyOutput.value = clubKey;
      renderQRCodes(qrCodes);

      generateResult.innerHTML = `
        <div class="success">
          <strong>Generated ${qrCodes.length} QR codes</strong>
          <p>Distribute the club key to verifiers. Send each QR code to the respective member.</p>
        </div>
      `;

      simpleCodesOutput.classList.add('hidden');
      qrCodesOutput.classList.remove('hidden');
    }

    generateResult.classList.remove('hidden');
    document.getElementById('output-section')?.classList.remove('hidden');
  } catch (err) {
    showError(generateResult, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Member Codes';
  }
});

// Download codes as CSV
downloadCodesBtn.addEventListener('click', () => {
  const codes = codesOutput.value;
  if (!codes) return;

  const clubId = clubIdInput.value.trim().toUpperCase();
  const blob = new Blob([`MemberCode\n${codes}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${clubId}-member-codes.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Copy club key
copyKeyBtn.addEventListener('click', async () => {
  const key = clubKeyOutput.value;
  if (!key) return;

  try {
    await navigator.clipboard.writeText(key);
    copyKeyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyKeyBtn.textContent = 'Copy Key';
    }, 2000);
  } catch {
    // Fallback for older browsers
    clubKeyOutput.select();
    document.execCommand('copy');
    copyKeyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyKeyBtn.textContent = 'Copy Key';
    }, 2000);
  }
});

// Print QR codes
downloadQrBtn.addEventListener('click', () => {
  window.print();
});

// Verify member code (handles both simple codes and QR data)
async function handleVerification() {
  const clubKeyStr = verifyClubKeyInput.value.trim();
  const clubId = verifyClubIdInput.value.trim().toUpperCase();
  const memberCode = memberCodeInput.value.trim();
  const qrData = memberCodeInput.dataset.qrData;

  // Validation
  if (!clubKeyStr) {
    showVerifyResult('error', 'Please enter the club verification key');
    return;
  }

  // QR code verification
  if (qrData) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';

    try {
      const clubKey = await importClubKey(clubKeyStr);
      const result = await decryptMemberData(clubKey, qrData);

      if (result.valid && result.name) {
        // Save the working key for future use
        saveClubKeyToStorage(clubKeyStr, clubId);
        showVerifyResult('valid', 'VALID MEMBER', result.name, result.index);

        // Clear the QR data after successful verification
        delete memberCodeInput.dataset.qrData;
        memberCodeInput.disabled = false;
        memberCodeInput.placeholder = '847291';
      } else {
        showVerifyResult('invalid', 'INVALID - Could not decrypt QR code');
      }
    } catch {
      showVerifyResult('error', 'Error: Invalid club key format');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify';
    }
    return;
  }

  // Simple 6-digit code verification
  if (!clubId) {
    showVerifyResult('error', 'Please enter the club ID');
    return;
  }

  if (!memberCode) {
    showVerifyResult('error', 'Please enter the member code');
    return;
  }

  // Quick format check
  const parsed = parseMemberCode(memberCode);
  if (!parsed) {
    showVerifyResult('invalid', 'INVALID - Incorrect code format');
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  try {
    const clubKey = await importClubKey(clubKeyStr);
    const result = await verifyMemberCode(memberCode, clubKey, clubId);

    if (result.valid) {
      // Save the working key for future use
      saveClubKeyToStorage(clubKeyStr, clubId);
      showVerifyResult('valid', 'VALID MEMBER');
    } else {
      const reasons: Record<string, string> = {
        invalid_format: 'INVALID - Code must be 6 digits',
        invalid_code: 'INVALID - Code not recognized',
      };
      showVerifyResult('invalid', reasons[result.reason || 'invalid_code']);
    }
  } catch {
    showVerifyResult('error', 'Error: Invalid club key format');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';
  }
}

verifyBtn.addEventListener('click', handleVerification);

// Clear result when inputs change
memberCodeInput.addEventListener('input', () => {
  verifyResult.classList.add('hidden');
});

// Helper functions
function showError(element: HTMLElement, message: string) {
  element.innerHTML = `<div class="error">${message}</div>`;
  element.classList.remove('hidden');
}

function showVerifyResult(type: 'valid' | 'invalid' | 'error', message: string, memberName?: string, memberIndex?: number) {
  verifyResult.className = `result ${type}`;

  if (type === 'valid' && memberName) {
    verifyResult.innerHTML = `
      <div>VALID MEMBER</div>
      <div class="member-name">${memberName}</div>
      ${memberIndex ? `<div class="member-index">#${memberIndex}</div>` : ''}
    `;
  } else {
    verifyResult.textContent = message;
  }

  verifyResult.classList.remove('hidden');
}

// Save club key to localStorage
function saveClubKeyToStorage(key: string, clubId: string) {
  try {
    localStorage.setItem(STORAGE_CLUB_KEY, key);
    localStorage.setItem(STORAGE_CLUB_ID, clubId);
  } catch {
    // Storage might be unavailable
  }
}

// Load club key from localStorage
function loadClubKeyFromStorage(): { key: string; clubId: string } | null {
  try {
    const key = localStorage.getItem(STORAGE_CLUB_KEY);
    const clubId = localStorage.getItem(STORAGE_CLUB_ID);
    if (key && clubId) {
      return { key, clubId };
    }
  } catch {
    // Storage might be unavailable
  }
  return null;
}

// Handle QR code verification from URL
async function handleQRVerification(encryptedData: string) {
  // Switch to verify tab
  tabVerify.click();

  // Load stored club key or prompt for it
  const stored = loadClubKeyFromStorage();
  if (stored) {
    verifyClubKeyInput.value = stored.key;
    verifyClubIdInput.value = stored.clubId;
  }

  // Show special QR verification UI
  memberCodeInput.value = '';
  memberCodeInput.placeholder = 'QR code detected...';
  memberCodeInput.disabled = true;

  // If we have a stored key, try to verify immediately
  if (stored) {
    try {
      const clubKey = await importClubKey(stored.key);
      const result = await decryptMemberData(clubKey, encryptedData);

      if (result.valid && result.name) {
        showVerifyResult('valid', 'VALID MEMBER', result.name, result.index);
      } else {
        showVerifyResult('invalid', 'INVALID - Could not decrypt QR code');
      }
    } catch {
      showVerifyResult('error', 'Error: Invalid club key');
    }
  } else {
    // No stored key - ask user to enter it
    showVerifyResult('error', 'Please enter the club key and click Verify');
    memberCodeInput.placeholder = 'QR verification pending...';

    // Store encrypted data for manual verification
    memberCodeInput.dataset.qrData = encryptedData;
  }
}

// Check for ?verify= parameter on page load
function checkVerifyParameter() {
  const params = new URLSearchParams(window.location.search);
  const verifyData = params.get('verify');

  if (verifyData) {
    // Remove the parameter from URL to allow page refresh
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    handleQRVerification(verifyData);
  }
}

// Initialize: check URL parameters and load stored values
function init() {
  // Load stored club key into verify form
  const stored = loadClubKeyFromStorage();
  if (stored) {
    verifyClubKeyInput.value = stored.key;
    verifyClubIdInput.value = stored.clubId;
  }

  // Check for QR verification parameter
  checkVerifyParameter();
}

// Run init when DOM is ready
init();
