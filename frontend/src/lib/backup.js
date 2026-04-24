// ══════════════════════════════════════════════════════════════
// backup.js — Encrypted wallet backup export (NO seed data!)
// Only exports wallet metadata (addresses, labels, settings)
// Seed phrases are NEVER included — they stay on the server
// ══════════════════════════════════════════════════════════════

// Collect all wallet-related localStorage data (NO seeds, NO private keys)
function collectWalletData() {
  const data = {};
  const keys = [
    "btc_wallets",
    "btc_active_wallet",
    "btc_address_book",
    "btc_tx_labels",
    "btc_utxo_labels",
    "btc_frozen_utxos",
    "btc_theme",
    "btc_lang",
    "btc_notify_settings",
  ];

  // Also grab vault data per-address
  const wallets = JSON.parse(localStorage.getItem("btc_wallets") || "[]");
  wallets.forEach((w) => {
    keys.push(`btc_vaults_${w.address}`);
    keys.push(`btc_cache_${w.address}_false`);
  });

  keys.forEach((key) => {
    const val = localStorage.getItem(key);
    if (val !== null) data[key] = val;
  });

  return data;
}

// Encrypt data with a password using AES-GCM (Web Crypto API)
async function encryptData(plaintext, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from password using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  // Combine salt + iv + ciphertext
  const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return result;
}

// Decrypt backup data
async function decryptData(encryptedBytes, password) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const salt = encryptedBytes.slice(0, 16);
  const iv = encryptedBytes.slice(16, 28);
  const ciphertext = encryptedBytes.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return dec.decode(plaintext);
}

// Export encrypted backup as downloadable file
export async function exportBackup(password) {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const walletData = collectWalletData();
  const payload = JSON.stringify({
    version: 1,
    app: "bit21",
    exportedAt: new Date().toISOString(),
    data: walletData,
  });

  const encrypted = await encryptData(payload, password);

  // Create downloadable blob
  const blob = new Blob([encrypted], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bit21-backup-${new Date().toISOString().slice(0, 10)}.b21`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}

// Import backup from file (restores wallet metadata)
export async function importBackup(file, password) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const json = await decryptData(bytes, password);
  const payload = JSON.parse(json);

  if (payload.app !== "bit21") throw new Error("Invalid backup file");

  // Restore each key to localStorage
  Object.entries(payload.data).forEach(([key, value]) => {
    // NEVER restore PIN hash — user must set PIN themselves
    if (key === "btc_pin_hash") return;
    localStorage.setItem(key, value);
  });

  return { version: payload.version, exportedAt: payload.exportedAt, keys: Object.keys(payload.data).length };
}
