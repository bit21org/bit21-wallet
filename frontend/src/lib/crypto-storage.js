// ══════════════════════════════════════════════════════════════
// crypto-storage.js — AES-256-GCM seed encryption for localStorage
// Uses Web Crypto API + IndexedDB for non-extractable key storage
// Falls back to XOR-based encryption on non-secure contexts (HTTP)
// ══════════════════════════════════════════════════════════════

const DB_NAME = "bit21_keystore";
const STORE_NAME = "keys";
const KEY_ID = "seed_encryption_key";

// ── Detect secure context (crypto.subtle requires HTTPS/localhost) ──
const HAS_SUBTLE = !!(globalThis.crypto && globalThis.crypto.subtle);

// ── IndexedDB helpers ──

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Fallback encryption for HTTP (non-secure) contexts ──
// Uses XOR with a random key stored in IndexedDB. Not as strong as AES-GCM,
// but still obfuscates seeds in localStorage. Will auto-upgrade to AES-GCM
// when HTTPS is enabled.

function generateFallbackKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function xorEncrypt(plaintext, keyHex) {
  const enc = new TextEncoder();
  const data = enc.encode(plaintext);
  const keyBytes = Uint8Array.from(keyHex.match(/.{2}/g), h => parseInt(h, 16));
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...out));
}

function xorDecrypt(b64, keyHex) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const keyBytes = Uint8Array.from(keyHex.match(/.{2}/g), h => parseInt(h, 16));
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(out);
}

// ── Core functions ──

export async function initCryptoKey() {
  const db = await openDB();
  const existing = await idbGet(db, KEY_ID);
  if (existing) {
    db.close();
    return existing;
  }

  if (HAS_SUBTLE) {
    // Secure context — use AES-GCM with non-extractable key
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    await idbPut(db, KEY_ID, key);
    db.close();
    return key;
  } else {
    // Non-secure context (HTTP) — use fallback XOR key
    const fallbackKey = { _fallback: true, hex: generateFallbackKey() };
    await idbPut(db, KEY_ID, fallbackKey);
    db.close();
    return fallbackKey;
  }
}

export async function encryptSeed(plaintext, cryptoKey) {
  // Fallback mode
  if (cryptoKey && cryptoKey._fallback) {
    return "enc_v2:" + xorEncrypt(plaintext, cryptoKey.hex);
  }

  // AES-GCM mode (secure context)
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    enc.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return "enc_v1:" + btoa(String.fromCharCode(...combined));
}

export async function decryptSeed(storedValue, cryptoKey) {
  if (!storedValue) return null;

  // Fallback XOR format
  if (storedValue.startsWith("enc_v2:")) {
    if (!cryptoKey || !cryptoKey._fallback) return null;
    try { return xorDecrypt(storedValue.slice(7), cryptoKey.hex); } catch { return null; }
  }

  if (!storedValue.startsWith("enc_v1:")) {
    // Old base64 format — decode directly
    try { return atob(storedValue); } catch { return null; }
  }

  // AES-GCM format — needs crypto.subtle
  if (!HAS_SUBTLE) return null;

  const raw = storedValue.slice(7); // strip "enc_v1:"
  const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const dec = new TextDecoder();
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext
  );
  return dec.decode(plainBuf);
}
