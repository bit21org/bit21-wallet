// ══════════════════════════════════════════════════════════════
// biometric.js — Biometric authentication for bit21
// Native app: @aparajita/capacitor-biometric-auth (via Capacitor.Plugins)
// Web: WebAuthn platform authenticator
// ══════════════════════════════════════════════════════════════

function isNative() {
  try {
    const cap = window.Capacitor;
    if (!cap) return false;
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    // Fallback: check if Capacitor platform is not 'web'
    if (cap.getPlatform && cap.getPlatform() !== 'web') return true;
    return false;
  } catch { return false; }
}

// Register the native biometric plugin using Capacitor core
import { registerPlugin } from '@capacitor/core';
const NativeBio = registerPlugin('NativeBiometric');

// ── Native biometric (Android/iOS) ──

async function nativeBioAvailable() {
  try {
    const result = await NativeBio.isAvailable();
    return result.isAvailable;
  } catch { return false; }
}

async function nativeBioRegister() {
  try {
    await NativeBio.verifyIdentity({
      reason: "Set up biometric lock for bit21",
      title: "bit21",
      subtitle: "Verify your identity",
      description: "Use fingerprint or face unlock",
      useFallback: true,
      fallbackTitle: "Use PIN",
    });
    localStorage.setItem("btc_bio_native", "1");
    localStorage.setItem("btc_bio_active", "1");
    return true;
  } catch (error) {
    const msg = error?.message || "";
    if (msg.includes("cancel") || msg.includes("Cancel") || msg.includes("dismissed")) {
      throw new Error("Biometric setup was cancelled.");
    }
    throw new Error("Biometric setup failed. Please try again.");
  }
}

async function nativeBioAuthenticate() {
  try {
    await NativeBio.verifyIdentity({
      reason: "Unlock bit21",
      title: "bit21",
      subtitle: "Verify to unlock",
      description: "Use fingerprint or face unlock",
      useFallback: true,
      fallbackTitle: "Use PIN",
    });
    return true;
  } catch (error) {
    const msg = error?.message || "";
    if (msg.includes("cancel") || msg.includes("Cancel") || msg.includes("dismissed")) {
      throw new Error("Authentication cancelled.");
    }
    throw new Error("Biometric verification failed. Please try again.");
  }
}

function nativeBioRegistered() {
  try { return !!localStorage.getItem("btc_bio_native"); } catch { return false; }
}

function nativeBioRemove() {
  localStorage.removeItem("btc_bio_native");
}

// ── WebAuthn (browser) ──

const RP_NAME = "bit21 Bitcoin Wallet";
const RP_ID = typeof window !== "undefined" ? window.location.hostname : "localhost";

function isWebAuthnSupported() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

async function webBioAvailable() {
  if (!window.isSecureContext) return false;
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

async function webBioRegister(userId = "bit21-user") {
  if (!window.isSecureContext) throw new Error("Biometric requires a secure (HTTPS) connection.");
  if (!isWebAuthnSupported()) throw new Error("Biometric is not supported on this browser.");

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userIdBytes = new TextEncoder().encode(userId);

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: RP_NAME, id: RP_ID },
        user: { id: userIdBytes, name: userId, displayName: "bit21 User" },
        challenge,
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    });
    const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem("btc_webauthn_cred", credId);
    return true;
  } catch (error) {
    const msg = error?.message || "";
    if (msg.includes("timed out") || msg.includes("not allowed")) {
      throw new Error("Biometric setup was cancelled or timed out. Please try again.");
    }
    throw new Error("Biometric setup failed. Please try again.");
  }
}

async function webBioAuthenticate() {
  if (!window.isSecureContext) throw new Error("Biometric requires a secure (HTTPS) connection.");
  const credIdB64 = localStorage.getItem("btc_webauthn_cred");
  if (!credIdB64) throw new Error("No biometric credential found. Please set up biometrics first.");

  const credIdBytes = Uint8Array.from(atob(credIdB64), (c) => c.charCodeAt(0));
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: RP_ID,
        allowCredentials: [{ type: "public-key", id: credIdBytes }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch (error) {
    const msg = error?.message || "";
    if (msg.includes("timed out") || msg.includes("not allowed")) {
      throw new Error("Biometric verification failed. Please try again.");
    }
    throw new Error("Biometric verification failed. Please try again.");
  }
}

function webBioRegistered() {
  try { return !!localStorage.getItem("btc_webauthn_cred"); } catch { return false; }
}

function webBioRemove() {
  localStorage.removeItem("btc_webauthn_cred");
}

// ── Unified exports (auto-detect native vs web) ──

export async function isPlatformAuthAvailable() {
  if (isNative()) {
    // On native, always return true — let the user try to register
    // If hardware isn't available, registerBiometric will show the real error
    return true;
  }
  return webBioAvailable();
}

export function isBiometricRegistered() {
  if (isNative()) return nativeBioRegistered();
  return webBioRegistered();
}

export async function registerBiometric(userId) {
  if (isNative()) return nativeBioRegister();
  return webBioRegister(userId);
}

export async function authenticateBiometric() {
  if (isNative()) return nativeBioAuthenticate();
  return webBioAuthenticate();
}

export function removeBiometric() {
  if (isNative()) return nativeBioRemove();
  return webBioRemove();
}

export { isWebAuthnSupported };
