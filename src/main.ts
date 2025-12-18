/**
 * Main application entry point.
 * Handles UI interactions for code generation and verification.
 */

import {
  generateCodesByCount,
  generateNamedCodesFromCSV,
  generateQRCodesFromCSV,
  importClubKey,
  verifyMemberCode,
  verifyNamedCode,
  decryptMemberData,
  parseMemberCode,
  CODE_SYSTEM_SALT,
  type CodeSystem,
  type NamedCodeResult,
  type QRCodeResult,
} from './crypto';

// Storage keys
const STORAGE_CLUB_KEY = 'membership-proof-club-key';
const STORAGE_LANG = 'membership-proof-lang';

// Translations
const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Membership Proof',
    subtitle: 'Privacy-preserving membership verification',
    tab_generate: 'Generate Codes',
    tab_verify: 'Verify Member',
    code_system: 'Code System',
    simple_codes_title: 'Simple 6-digit codes',
    simple_codes_desc: 'Easy to remember, just specify how many codes you need',
    named_codes_title: 'Name + code (SMITH.847291)',
    named_codes_desc: 'Member says name and code, verifier sees if they match',
    qr_codes_title: 'QR codes with names',
    qr_codes_desc: 'Upload member list, QR reveals name when scanned',
    code_count: 'Number of Codes',
    code_count_hint: 'How many member codes to generate (max 1000)',
    member_list: 'Member List (CSV)',
    drop_zone_text: 'Drag & drop CSV file here',
    drop_zone_or: 'or',
    drop_zone_browse: 'click to browse',
    csv_hint: 'First column should contain surnames. Data is processed locally.',
    csv_hint_named: 'First column should contain surnames. Each name gets a unique code.',
    named_codes: 'Named Codes',
    named_codes_hint: 'Give each member their code (just the number - they know their name).',
    base_url: 'Verification URL Base',
    base_url_hint: 'The URL where your app is hosted (auto-filled)',
    club_id: 'Club ID',
    club_id_hint: 'Short identifier for your club (letters, numbers, hyphens)',
    admin_password: 'Admin Password',
    admin_password_hint: 'Keep this secret. Same password regenerates the same club key.',
    generate_btn: 'Generate Codes',
    club_key: 'Club Verification Key',
    copy_key: 'Copy Key',
    club_key_hint: 'Share this key with verifiers (trainers, officials)',
    member_codes: 'Member Codes',
    download_csv: 'Download CSV',
    codes_hint: 'Give one code to each member. Codes contain no personal data.',
    qr_codes: 'QR Codes',
    print_all: 'Print All',
    qr_hint: 'Each QR contains encrypted member name. Send individually to members.',
    verify_club_key: 'Club Verification Key',
    verify_club_id: 'Club ID',
    member_code: 'Member Code',
    member_code_hint: 'Enter 6-digit code or NAME.CODE format',
    verify_btn: 'Verify',
    privacy_title: 'Privacy by Design',
    privacy_text: 'All processing happens in your browser. No data is sent to any server. Member codes contain no personal information - they are cryptographic proofs only.',
    lang_toggle: 'Suomeksi',
    generated_codes: 'Generated {count} member codes',
    generated_named: 'Generated {count} named codes',
    generated_qr: 'Generated {count} QR codes',
    distribute_key: 'Share the club key with verifiers. Give one code to each member.',
    distribute_named: 'Share the club key with verifiers. Give each member their number (they know their name).',
    distribute_qr: 'Share the club key with verifiers. Send each QR to the respective member.',
    valid_member: 'VALID MEMBER',
    invalid_format: 'INVALID - Incorrect code format',
    invalid_code: 'INVALID - Code not recognized',
    invalid_qr: 'INVALID - Could not decrypt QR code',
    error_key: 'Error: Invalid club key format',
    error_select_csv: 'Please select a CSV file',
    error_club_id: 'Please enter a club ID (at least 2 characters)',
    error_club_id_format: 'Club ID can only contain letters, numbers, and hyphens',
    error_password: 'Admin password must be at least 8 characters',
    error_base_url: 'Please enter the verification URL base',
    error_count: 'Please enter a valid number of codes (1-1000)',
    error_enter_key: 'Please enter the club verification key',
    error_enter_club_id: 'Please enter the club ID',
    error_enter_code: 'Please enter the member code',
    copied: 'Copied!',
    generating: 'Generating...',
    verifying: 'Verifying...',
  },
  fi: {
    title: 'Jäsenyyden todentaminen',
    subtitle: 'Yksityisyyttä suojaava jäsenyyden varmistus',
    tab_generate: 'Luo koodeja',
    tab_verify: 'Tarkista jäsen',
    code_system: 'Koodijärjestelmä',
    simple_codes_title: 'Yksinkertaiset 6-numeroiset koodit',
    simple_codes_desc: 'Helppo muistaa, määritä vain koodien lukumäärä',
    named_codes_title: 'Nimi + koodi (VIRTANEN.847291)',
    named_codes_desc: 'Jäsen sanoo nimen ja koodin, tarkistaja näkee täsmäävätkö',
    qr_codes_title: 'QR-koodit nimillä',
    qr_codes_desc: 'Lataa jäsenlista, QR näyttää nimen skannattaessa',
    code_count: 'Koodien määrä',
    code_count_hint: 'Kuinka monta jäsenkoodia luodaan (max 1000)',
    member_list: 'Jäsenlista (CSV)',
    drop_zone_text: 'Vedä ja pudota CSV-tiedosto tähän',
    drop_zone_or: 'tai',
    drop_zone_browse: 'klikkaa selataksesi',
    csv_hint: 'Ensimmäisen sarakkeen tulee sisältää sukunimet. Data käsitellään paikallisesti.',
    csv_hint_named: 'Ensimmäisen sarakkeen tulee sisältää sukunimet. Jokainen nimi saa oman koodin.',
    named_codes: 'Nimikoodit',
    named_codes_hint: 'Anna jokaiselle jäsenelle hänen koodinsa (pelkkä numero - he tietävät nimensä).',
    base_url: 'Varmistus-URL:n pohja',
    base_url_hint: 'URL jossa sovellus on julkaistu (täytetään automaattisesti)',
    club_id: 'Seuran tunnus',
    club_id_hint: 'Lyhyt tunniste seurallesi (kirjaimia, numeroita, väliviivoja)',
    admin_password: 'Ylläpitäjän salasana',
    admin_password_hint: 'Pidä salassa. Sama salasana tuottaa saman seuran avaimen.',
    generate_btn: 'Luo koodit',
    club_key: 'Seuran varmistusavain',
    copy_key: 'Kopioi avain',
    club_key_hint: 'Jaa tämä avain varmistajille (valmentajat, tuomarit)',
    member_codes: 'Jäsenkoodit',
    download_csv: 'Lataa CSV',
    codes_hint: 'Anna yksi koodi jokaiselle jäsenelle. Koodit eivät sisällä henkilötietoja.',
    qr_codes: 'QR-koodit',
    print_all: 'Tulosta kaikki',
    qr_hint: 'Jokainen QR sisältää salatun jäsenen nimen. Lähetä erikseen jäsenille.',
    verify_club_key: 'Seuran varmistusavain',
    verify_club_id: 'Seuran tunnus',
    member_code: 'Jäsenkoodi',
    member_code_hint: 'Syötä 6-numeroinen koodi tai NIMI.KOODI-muoto',
    verify_btn: 'Varmista',
    privacy_title: 'Yksityisyys sisäänrakennettuna',
    privacy_text: 'Kaikki käsittely tapahtuu selaimessasi. Mitään dataa ei lähetetä palvelimelle. Jäsenkoodit eivät sisällä henkilötietoja - ne ovat vain kryptografisia todisteita.',
    lang_toggle: 'In English',
    generated_codes: 'Luotiin {count} jäsenkoodia',
    generated_named: 'Luotiin {count} nimikoodia',
    generated_qr: 'Luotiin {count} QR-koodia',
    distribute_key: 'Jaa seuran avain varmistajille. Anna yksi koodi jokaiselle jäsenelle.',
    distribute_named: 'Jaa seuran avain varmistajille. Anna jokaiselle jäsenelle hänen numeronsa (he tietävät nimensä).',
    distribute_qr: 'Jaa seuran avain varmistajille. Lähetä jokainen QR vastaavalle jäsenelle.',
    valid_member: 'VOIMASSA OLEVA JÄSEN',
    invalid_format: 'VIRHEELLINEN - Väärä koodimuoto',
    invalid_code: 'VIRHEELLINEN - Koodia ei tunnistettu',
    invalid_qr: 'VIRHEELLINEN - QR-koodia ei voitu purkaa',
    error_key: 'Virhe: Virheellinen avainmuoto',
    error_select_csv: 'Valitse CSV-tiedosto',
    error_club_id: 'Syötä seuran tunnus (vähintään 2 merkkiä)',
    error_club_id_format: 'Seuran tunnus voi sisältää vain kirjaimia, numeroita ja väliviivoja',
    error_password: 'Salasanan tulee olla vähintään 8 merkkiä',
    error_base_url: 'Syötä varmistus-URL:n pohja',
    error_count: 'Syötä kelvollinen koodien määrä (1-1000)',
    error_enter_key: 'Syötä seuran varmistusavain',
    error_enter_club_id: 'Syötä seuran tunnus',
    error_enter_code: 'Syötä jäsenkoodi',
    copied: 'Kopioitu!',
    generating: 'Luodaan...',
    verifying: 'Varmistetaan...',
  }
};

let currentLang = localStorage.getItem(STORAGE_LANG) || 'en';

function t(key: string, replacements?: Record<string, string | number>): string {
  let text = translations[currentLang]?.[key] || translations['en'][key] || key;
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

function updateLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.textContent = t('lang_toggle');
  }
}

// DOM Elements
const tabGenerate = document.getElementById('tab-generate') as HTMLButtonElement;
const tabVerify = document.getElementById('tab-verify') as HTMLButtonElement;
const generateSection = document.getElementById('generate-section') as HTMLElement;
const verifySection = document.getElementById('verify-section') as HTMLElement;

// Generate form elements
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const csvFileInput = document.getElementById('csv-file') as HTMLInputElement;
const fileNameDisplay = document.getElementById('file-name') as HTMLElement;
const codeCountInput = document.getElementById('code-count') as HTMLInputElement;
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
const simpleInputs = document.getElementById('simple-inputs') as HTMLElement;
const namedInputs = document.getElementById('named-inputs') as HTMLElement;
const qrInputs = document.getElementById('qr-inputs') as HTMLElement;
const baseUrlInput = document.getElementById('base-url') as HTMLInputElement;
const simpleCodesOutput = document.getElementById('simple-codes-output') as HTMLElement;
const namedCodesOutput = document.getElementById('named-codes-output') as HTMLElement;
const namedCodesTextarea = document.getElementById('named-codes-textarea') as HTMLTextAreaElement;
const qrCodesOutput = document.getElementById('qr-codes-output') as HTMLElement;
const qrGrid = document.getElementById('qr-grid') as HTMLElement;
const downloadQrBtn = document.getElementById('download-qr-btn') as HTMLButtonElement;
const downloadNamedBtn = document.getElementById('download-named-btn') as HTMLButtonElement;

// Named code file elements
const dropZoneNamed = document.getElementById('drop-zone-named') as HTMLElement;
const csvFileNamedInput = document.getElementById('csv-file-named') as HTMLInputElement;
const fileNameNamedDisplay = document.getElementById('file-name-named') as HTMLElement;

// Store named codes for download
let currentNamedCodes: NamedCodeResult[] = [];

// Verify form elements
const verifyClubKeyInput = document.getElementById('verify-club-key') as HTMLInputElement;
const memberCodeInput = document.getElementById('member-code') as HTMLInputElement;
const verifyBtn = document.getElementById('verify-btn') as HTMLButtonElement;
const verifyResult = document.getElementById('verify-result') as HTMLElement;

// Language toggle
const langToggle = document.getElementById('lang-toggle') as HTMLButtonElement;
langToggle.addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'fi' : 'en';
  localStorage.setItem(STORAGE_LANG, currentLang);
  updateLanguage();
});

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

// Club ID form group
const clubIdGroup = clubIdInput.closest('.form-group') as HTMLElement;

codeSystemRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    const system = getSelectedCodeSystem();
    simpleInputs.classList.add('hidden');
    namedInputs.classList.add('hidden');
    qrInputs.classList.add('hidden');

    if (system === 'simple') {
      simpleInputs.classList.remove('hidden');
      clubIdGroup.classList.add('hidden'); // No club ID needed
    } else if (system === 'named') {
      namedInputs.classList.remove('hidden');
      clubIdGroup.classList.add('hidden'); // No club ID needed
    } else {
      qrInputs.classList.remove('hidden');
      clubIdGroup.classList.remove('hidden'); // QR needs club name for display
      // Auto-fill base URL
      if (!baseUrlInput.value) {
        baseUrlInput.value = window.location.origin + window.location.pathname.replace(/\/$/, '');
      }
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

// Named file handling
function updateFileDisplayNamed(file: File | null) {
  if (file) {
    fileNameNamedDisplay.textContent = `✓ ${file.name}`;
    dropZoneNamed.classList.add('has-file');
  } else {
    fileNameNamedDisplay.textContent = '';
    dropZoneNamed.classList.remove('has-file');
  }
}

function handleFileNamed(file: File) {
  if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    csvFileNamedInput.files = dataTransfer.files;
    updateFileDisplayNamed(file);
  }
}

dropZoneNamed.addEventListener('click', () => {
  csvFileNamedInput.click();
});

csvFileNamedInput.addEventListener('change', () => {
  const file = csvFileNamedInput.files?.[0] || null;
  updateFileDisplayNamed(file);
});

dropZoneNamed.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZoneNamed.classList.add('drag-over');
});

dropZoneNamed.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZoneNamed.classList.remove('drag-over');
});

dropZoneNamed.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZoneNamed.classList.remove('drag-over');

  const file = e.dataTransfer?.files[0];
  if (file) {
    handleFileNamed(file);
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
  const clubId = clubIdInput.value.trim().toUpperCase();
  const adminPassword = adminPasswordInput.value;
  const codeSystem = getSelectedCodeSystem();

  // Password validation (common to all systems)
  if (!adminPassword || adminPassword.length < 8) {
    showError(generateResult, t('error_password'));
    return;
  }

  // Club ID validation only for QR codes
  if (codeSystem === 'qr') {
    if (!clubId || clubId.length < 2) {
      showError(generateResult, t('error_club_id'));
      return;
    }

    if (!/^[A-Z0-9-]+$/.test(clubId)) {
      showError(generateResult, t('error_club_id_format'));
      return;
    }
  }

  if (codeSystem === 'simple') {
    // Simple code validation
    const count = parseInt(codeCountInput.value, 10);
    if (isNaN(count) || count < 1 || count > 1000) {
      showError(generateResult, t('error_count'));
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = t('generating');

    try {
      const { clubKey, codes } = await generateCodesByCount(count, adminPassword);

      clubKeyOutput.value = clubKey;
      codesOutput.value = codes.join('\n');

      generateResult.innerHTML = `
        <div class="success">
          <strong>${t('generated_codes', { count: codes.length })}</strong>
          <p>${t('distribute_key')}</p>
        </div>
      `;

      simpleCodesOutput.classList.remove('hidden');
      namedCodesOutput.classList.add('hidden');
      qrCodesOutput.classList.add('hidden');
      generateResult.classList.remove('hidden');
      document.getElementById('output-section')?.classList.remove('hidden');
    } catch (err) {
      showError(generateResult, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = t('generate_btn');
    }
  } else if (codeSystem === 'named') {
    // Named code generation - no club ID needed
    const file = csvFileNamedInput.files?.[0];
    if (!file) {
      showError(generateResult, t('error_select_csv'));
      return;
    }

    if (!adminPassword || adminPassword.length < 8) {
      showError(generateResult, t('error_password'));
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = t('generating');

    try {
      const csvContent = await file.text();
      const { clubKey, codes } = await generateNamedCodesFromCSV(csvContent, adminPassword);

      clubKeyOutput.value = clubKey;
      currentNamedCodes = codes;

      // Show NAME.CODE format in textarea (same format used for verification)
      namedCodesTextarea.value = codes.map(c => `${c.name}.${c.code}`).join('\n');

      generateResult.innerHTML = `
        <div class="success">
          <strong>${t('generated_named', { count: codes.length })}</strong>
          <p>${t('distribute_named')}</p>
        </div>
      `;

      simpleCodesOutput.classList.add('hidden');
      namedCodesOutput.classList.remove('hidden');
      qrCodesOutput.classList.add('hidden');
      generateResult.classList.remove('hidden');
      document.getElementById('output-section')?.classList.remove('hidden');
    } catch (err) {
      showError(generateResult, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = t('generate_btn');
    }
  } else {
    // QR code validation
    const file = csvFileInput.files?.[0];
    if (!file) {
      showError(generateResult, t('error_select_csv'));
      return;
    }

    if (!baseUrlInput.value.trim()) {
      showError(generateResult, t('error_base_url'));
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = t('generating');

    try {
      const csvContent = await file.text();
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
          <strong>${t('generated_qr', { count: qrCodes.length })}</strong>
          <p>${t('distribute_qr')}</p>
        </div>
      `;

      simpleCodesOutput.classList.add('hidden');
      namedCodesOutput.classList.add('hidden');
      qrCodesOutput.classList.remove('hidden');
      generateResult.classList.remove('hidden');
      document.getElementById('output-section')?.classList.remove('hidden');
    } catch (err) {
      showError(generateResult, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = t('generate_btn');
    }
  }
});

// Download named codes as CSV
downloadNamedBtn.addEventListener('click', () => {
  if (currentNamedCodes.length === 0) return;

  const clubId = clubIdInput.value.trim().toUpperCase();
  const csvContent = 'Name,Code\n' + currentNamedCodes.map(c => `${c.name},${c.code}`).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${clubId}-named-codes.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
    copyKeyBtn.textContent = t('copied');
    setTimeout(() => {
      copyKeyBtn.textContent = t('copy_key');
    }, 2000);
  } catch {
    clubKeyOutput.select();
    document.execCommand('copy');
    copyKeyBtn.textContent = t('copied');
    setTimeout(() => {
      copyKeyBtn.textContent = t('copy_key');
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
  const memberCode = memberCodeInput.value.trim();
  const qrData = memberCodeInput.dataset.qrData;

  // Validation
  if (!clubKeyStr) {
    showVerifyResult('error', t('error_enter_key'));
    return;
  }

  // QR code verification
  if (qrData) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = t('verifying');

    try {
      const clubKey = await importClubKey(clubKeyStr);
      const result = await decryptMemberData(clubKey, qrData);

      if (result.valid && result.name) {
        saveClubKeyToStorage(clubKeyStr);
        showVerifyResult('valid', t('valid_member'), result.name, result.index);

        delete memberCodeInput.dataset.qrData;
        memberCodeInput.disabled = false;
        memberCodeInput.placeholder = '847291';
      } else {
        showVerifyResult('invalid', t('invalid_qr'));
      }
    } catch {
      showVerifyResult('error', t('error_key'));
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = t('verify_btn');
    }
    return;
  }

  // Check if it's a named code (NAME.123456X format, 6 digits + letter suffix)
  const isNamedCode = /^[A-Za-z\u00C0-\u017F][A-Za-z\u00C0-\u017F\s\-]*\.\d{6}[A-Z]$/i.test(memberCode);

  if (isNamedCode) {
    // Named code verification - no club ID needed
    verifyBtn.disabled = true;
    verifyBtn.textContent = t('verifying');

    try {
      const clubKey = await importClubKey(clubKeyStr);
      const result = await verifyNamedCode(memberCode, clubKey);

      if (result.valid && result.name) {
        saveClubKeyToStorage(clubKeyStr);
        showVerifyResult('valid', t('valid_member'), result.name);
      } else {
        showVerifyResult('invalid', t('invalid_code'));
      }
    } catch {
      showVerifyResult('error', t('error_key'));
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = t('verify_btn');
    }
    return;
  }

  // Simple 6-digit code verification (uses 'SIMPLE' as fixed club ID)
  if (!memberCode) {
    showVerifyResult('error', t('error_enter_code'));
    return;
  }

  const parsed = parseMemberCode(memberCode);
  if (!parsed) {
    showVerifyResult('invalid', t('invalid_format'));
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = t('verifying');

  try {
    const clubKey = await importClubKey(clubKeyStr);
    const result = await verifyMemberCode(memberCode, clubKey, CODE_SYSTEM_SALT);

    if (result.valid) {
      saveClubKeyToStorage(clubKeyStr);
      showVerifyResult('valid', t('valid_member'));
    } else {
      showVerifyResult('invalid', t('invalid_code'));
    }
  } catch {
    showVerifyResult('error', t('error_key'));
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = t('verify_btn');
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
      <div>${message}</div>
      <div class="member-name">${memberName}</div>
      ${memberIndex ? `<div class="member-index">#${memberIndex}</div>` : ''}
    `;
  } else {
    verifyResult.textContent = message;
  }

  verifyResult.classList.remove('hidden');
}

// Save club key to localStorage
function saveClubKeyToStorage(key: string) {
  try {
    localStorage.setItem(STORAGE_CLUB_KEY, key);
  } catch {
    // Storage might be unavailable
  }
}

// Load club key from localStorage
function loadClubKeyFromStorage(): string | null {
  try {
    const key = localStorage.getItem(STORAGE_CLUB_KEY);
    if (key) {
      return key;
    }
  } catch {
    // Storage might be unavailable
  }
  return null;
}

// Handle QR code verification from URL
async function handleQRVerification(encryptedData: string) {
  tabVerify.click();

  const storedKey = loadClubKeyFromStorage();
  if (storedKey) {
    verifyClubKeyInput.value = storedKey;
  }

  memberCodeInput.value = '';
  memberCodeInput.placeholder = 'QR...';
  memberCodeInput.disabled = true;

  if (storedKey) {
    try {
      const clubKey = await importClubKey(storedKey);
      const result = await decryptMemberData(clubKey, encryptedData);

      if (result.valid && result.name) {
        showVerifyResult('valid', t('valid_member'), result.name, result.index);
      } else {
        showVerifyResult('invalid', t('invalid_qr'));
      }
    } catch {
      showVerifyResult('error', t('error_key'));
    }
  } else {
    showVerifyResult('error', t('error_enter_key'));
    memberCodeInput.dataset.qrData = encryptedData;
  }
}

// Check for ?verify= parameter on page load
function checkVerifyParameter() {
  const params = new URLSearchParams(window.location.search);
  const verifyData = params.get('verify');

  if (verifyData) {
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    handleQRVerification(verifyData);
  }
}

// Initialize
function init() {
  updateLanguage();

  const storedKey = loadClubKeyFromStorage();
  if (storedKey) {
    verifyClubKeyInput.value = storedKey;
  }

  checkVerifyParameter();
}

init();
