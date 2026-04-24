import { useState, useEffect } from "react";
import {
  validateSeedPhrase,
  deriveAllAddresses,
  deriveAddress,
  importFromWIF,
  detectInputType,
  ADDRESS_TYPES,
  validatePhraseWords,
} from "../lib/bitcoin.js";
import { getBalance } from "../lib/api.js";
import { getUserFriendlyError } from "../lib/errors.js";
import { t } from "../lib/i18n.js";
import { isMobileDevice } from "../App.jsx";
import { enableScreenSecurity, disableScreenSecurity } from "../lib/native-push.js";

export default function Import({ onDone, onBack }) {
  // Block screenshots while seed/private key is visible
  useEffect(() => { enableScreenSecurity(); return () => disableScreenSecurity(); }, []);
  // Mainnet only
  const testnet = false;
  const [step, setStep] = useState("input"); // "input" | "detecting" | "select" | "saving" | "success"

  // Register global back handler for browser back button
  useEffect(() => {
    window._bit21ImportBack = () => {
      if (step === "select") { setStep("input"); return "step"; }
      if (step === "input") { onBack(); return "exit"; }
      // detecting, saving, success — don't go back
      return false;
    };
    return () => { delete window._bit21ImportBack; };
  });
  const [mode, setMode] = useState("seed"); // "seed" or "key"
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState(null);
  const [selectedType, setSelectedType] = useState("NATIVE_SEGWIT");
  const [addressBalances, setAddressBalances] = useState({});
  const [wordValidation, setWordValidation] = useState([]);
  const [detectedBalance, setDetectedBalance] = useState(null);
  const [detectProgress, setDetectProgress] = useState(0);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showPassphraseText, setShowPassphraseText] = useState(false);

  const C = {
    bg: "#0D0D0D", surface: "#141414", border: "#1F1F1F", borderLight: "#2A2A2A",
    orange: "#F7931A", orangeDark: "#D4780E", white: "#FAFAFA",
    gray: "#737373", grayLight: "#A3A3A3", red: "#EF4444", green: "#22C55E",
    amber: "#F59E0B", amberBg: "rgba(251, 191, 36, 0.1)", amberBorder: "rgba(251, 191, 36, 0.3)",
  };

  const stepNum = step === "input" ? 1 : step === "detecting" ? 2 : step === "select" ? 2 : step === "saving" ? 2 : 2;
  const [inputFocused, setInputFocused] = useState(false);

  // Smart word count
  const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0;
  const isValidCount = wordCount === 12 || wordCount === 24;
  const isTooMany = wordCount > 24;

  // Step 1: Validate input and start detection
  const handleContinue = async () => {
    setError("");
    const trimmed = input.trim();

    // Auto-detect input type
    const detected = detectInputType(trimmed);

    if (detected.type === "invalid") {
      setError(detected.error);
      return;
    }

    if (detected.type === "wif") {
      // WIF key - skip address selection, go straight to save
      handleSaveWIF(trimmed);
      return;
    }

    // Seed phrase - derive all addresses and check balances
    try {
      setStep("detecting");
      setDetectProgress(1);
      const allAddresses = await deriveAllAddresses(trimmed.toLowerCase(), testnet, passphrase);
      setAddresses(allAddresses);
      setDetectProgress(2);

      // Check balances on all addresses in parallel
      const balanceChecks = await Promise.allSettled(
        Object.entries(allAddresses).map(async ([type, data]) => {
          if (data.error || !data.address) return { type, balance: 0 };
          try {
            const bal = await getBalance(data.address, testnet, true);
            return { type, balance: bal.totalSats || 0 };
          } catch {
            return { type, balance: 0 };
          }
        })
      );

      setDetectProgress(3);

      const balances = {};
      balanceChecks.forEach(result => {
        if (result.status === "fulfilled") {
          balances[result.value.type] = result.value.balance;
        }
      });
      setAddressBalances(balances);
      setDetectProgress(4);

      // HD address discovery — scan indices 1-19 for each type
      const discoveredAddrs = [];
      const nextIdx = { LEGACY: 1, SEGWIT_COMPAT: 1, NATIVE_SEGWIT: 1, TAPROOT: 1 };
      const apiBase = window.Capacitor?.isNativePlatform?.() ? "https://wallet.bit21.app" : "";
      for (const tk of Object.keys(ADDRESS_TYPES)) {
        let gap = 0;
        for (let idx = 1; idx < 20 && gap < 3; idx++) {
          try {
            const derived = await deriveAddress(trimmed.toLowerCase(), tk, testnet, idx, passphrase);
            await new Promise(r => setTimeout(r, 250));
            const res = await fetch(`${apiBase}/api/wallet/balance/${derived.address}${testnet ? "?network=testnet" : ""}`);
            if (!res.ok) { gap++; continue; }
            const data = await res.json();
            const txCount = (data.chain_stats?.tx_count || 0) + (data.mempool_stats?.tx_count || 0);
            const funded = (data.chain_stats?.funded_txo_sum || 0) + (data.mempool_stats?.funded_txo_sum || 0);
            if (txCount > 0 || funded > 0) {
              discoveredAddrs.push({ type: tk, address: derived.address, path: derived.path, index: idx, isDefault: false });
              if (idx >= nextIdx[tk]) nextIdx[tk] = idx + 1;
              gap = 0;
            } else { gap++; }
          } catch { gap++; }
        }
      }

      // Find addresses with balance
      const withBalance = Object.entries(balances).filter(([, bal]) => bal > 0);

      if (withBalance.length === 1) {
        setDetectedBalance(withBalance[0][1]);
        setSelectedType(withBalance[0][0]);
        handleSaveAddress(allAddresses, withBalance[0][0], trimmed, discoveredAddrs, nextIdx);
      } else if (withBalance.length > 1) {
        setSelectedType(withBalance[0][0]);
        setStep("select");
        // Store discovery results for later use when select completes
        window._bit21Discovery = { addrs: discoveredAddrs, nextIdx };
      } else {
        setSelectedType("NATIVE_SEGWIT");
        handleSaveAddress(allAddresses, "NATIVE_SEGWIT", trimmed, discoveredAddrs, nextIdx);
      }
    } catch (err) {
      setError(getUserFriendlyError(err));
      setStep("input");
    }
  };

  // Save selected address
  const handleSaveAddress = async (addrs = addresses, type = selectedType, seed = input, hdAddrs = null, hdNextIdx = null) => {
    setError("");
    setSaving(true);
    setStep("saving");

    try {
      const selectedAddress = addrs[type];
      if (!selectedAddress || selectedAddress.error) {
        throw new Error("Selected address type is not available");
      }

      if (addressBalances[type] > 0) {
        setDetectedBalance(addressBalances[type]);
      }

      // Get discovery results (either passed directly or from global)
      const discovered = hdAddrs || window._bit21Discovery?.addrs || [];
      const nextIdx = hdNextIdx || window._bit21Discovery?.nextIdx || null;
      delete window._bit21Discovery;

      const seedData = passphrase ? seed.trim().toLowerCase() + "\n__EXT__:" + passphrase : seed.trim().toLowerCase();

      setStep("success");
      setTimeout(() => onDone(selectedAddress.address, seedData, discovered, nextIdx), 2500);
    } catch (err) {
      setError(getUserFriendlyError(err));
      setSaving(false);
      setStep("select");
    }
  };

  // Handle WIF key import
  const handleSaveWIF = async (wif) => {
    setSaving(true);
    setStep("saving");

    try {
      const result = importFromWIF(wif, testnet);

      setStep("success");
      setTimeout(() => onDone(result.address, wif), 2500);
    } catch (err) {
      setError(getUserFriendlyError(err));
      setSaving(false);
      setStep("input");
    }
  };

  // Format balance for display
  const formatBalance = (sats) => {
    if (!sats || sats === 0) return null;
    const btc = sats / 1e8;
    return btc < 0.0001 ? `${sats.toLocaleString()} sats` : `${btc.toFixed(8)} BTC`;
  };

  /* ═══ Progress Stepper ═══ */
  const Stepper = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 28 }}>
      {[1, 2].map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 14,
            background: stepNum >= s ? C.orange : C.surface,
            border: `2px solid ${stepNum >= s ? C.orange : C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
            color: stepNum >= s ? C.bg : C.gray,
            transition: "all 0.3s",
          }}>
            {stepNum > s ? "✓" : s}
          </div>
          {i === 0 && <div style={{
            width: 40, height: 2, borderRadius: 1,
            background: stepNum >= 2 ? C.orange : C.border,
            transition: "all 0.3s",
          }} />}
        </div>
      ))}
    </div>
  );

  // Clipboard paste helper
  const handlePaste = async () => {
    try {
      let text = '';
      if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.Clipboard) {
        try { const r = await window.Capacitor.Plugins.Clipboard.read(); text = r?.value || ''; } catch {}
      }
      if (!text && navigator.clipboard?.readText) {
        try { text = await navigator.clipboard.readText(); } catch {}
      }
      if (!text) {
        const ta = document.createElement('textarea');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); document.execCommand('paste');
        text = ta.value; document.body.removeChild(ta);
      }
      if (text) {
        setInput(text);
        if (text.trim()) setWordValidation(validatePhraseWords(text));
      }
    } catch {}
  };

  // Input step UI
  const renderInputStep = () => (
    <>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, margin: "0 auto 16px",
          background: `linear-gradient(135deg, ${C.orange}20, ${C.orange}08)`,
          border: `1px solid ${C.orange}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Restore Your Wallet
        </h2>
        <p style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
          Enter your recovery phrase to access your Bitcoin.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{
        display: "flex", gap: 3, background: C.surface, borderRadius: 12, padding: 3,
        marginBottom: 20, border: `1px solid ${C.border}`,
      }}>
        {[
          { id: "seed", label: "Recovery Phrase" },
          { id: "key", label: "Private Key" },
        ].map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setInput(""); setError(""); setWordValidation([]); setPassphrase(""); setShowPassphrase(false); }}
            style={{
              flex: 1, padding: "11px", borderRadius: 10, border: "none", cursor: "pointer",
              background: mode === m.id ? C.orange : "transparent",
              color: mode === m.id ? C.bg : C.gray,
              fontSize: 13, fontWeight: 700, transition: "all 0.2s",
            }}>{m.label}</button>
        ))}
      </div>

      {mode === "seed" ? (
        <div>
          {/* Textarea with inline paste icon */}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <textarea
              value={input}
              onChange={e => {
                const value = e.target.value;
                setInput(value);
                if (value.trim()) setWordValidation(validatePhraseWords(value));
                else setWordValidation([]);
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Enter your 12 or 24 word recovery phrase"
              rows={5}
              style={{
                width: "100%", padding: "16px 44px 16px 16px", borderRadius: 14,
                border: `1.5px solid ${inputFocused ? C.orange : C.border}`,
                background: C.surface, color: C.white, fontSize: 15,
                fontFamily: "'SF Mono', monospace", resize: "none", outline: "none",
                lineHeight: 1.8, boxSizing: "border-box", transition: "border-color 0.2s",
                minHeight: 140,
              }}
            />
            {/* Paste icon inside textarea */}
            {!input.trim() && (
              <button onClick={handlePaste} style={{
                position: "absolute", right: 10, top: 12,
                background: "none", border: "none", cursor: "pointer", color: C.orange, padding: 4,
              }} title="Paste">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            )}
          </div>

          {/* Word count */}
          {wordCount > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, marginBottom: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: isValidCount ? C.green : isTooMany ? C.red : C.gray,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {wordCount} words
                {isValidCount && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                {isTooMany && <span>too many</span>}
              </span>
            </div>
          )}
          {!wordCount && <div style={{ height: 8 }} />}

          {/* Word validation pills */}
          {wordValidation.length > 0 && wordValidation.some(w => !w.valid) && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {wordValidation.filter(w => !w.valid).map((w, i) => (
                  <div key={i} style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 12,
                    background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)",
                    color: C.amber,
                  }}>
                    {w.word}{w.suggestions.length > 0 && <span style={{ opacity: 0.7 }}> → {w.suggestions[0]}?</span>}
                  </div>
                ))}
              </div>
              {wordValidation.some(w => !w.valid && w.suggestions.length > 0) && (
                <button onClick={() => {
                  const corrected = wordValidation.map(w => w.valid ? w.word : (w.suggestions[0] || w.word)).join(' ');
                  setInput(corrected); setWordValidation(validatePhraseWords(corrected));
                }} style={{
                  marginTop: 6, padding: "6px 12px", borderRadius: 8,
                  background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                  color: C.amber, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Apply corrections</button>
              )}
            </div>
          )}

          {/* Passphrase - minimal, only after valid word count */}
          {isValidCount && !showPassphrase && (
            <button onClick={() => setShowPassphrase(true)} style={{
              background: "none", border: "none", color: C.gray, fontSize: 12,
              cursor: "pointer", padding: 0, marginBottom: 16,
            }}>
              Have a passphrase?
            </button>
          )}
          {isValidCount && showPassphrase && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                <button onClick={() => { setShowPassphrase(false); setPassphrase(""); }} style={{
                  background: "none", border: "none", color: C.gray, fontSize: 11, cursor: "pointer", padding: 0,
                }}>Hide</button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassphraseText ? "text" : "password"}
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  placeholder={wordCount === 24 ? "Enter 25th word" : "Enter 13th word"}
                  maxLength={100}
                  autoFocus
                  style={{
                    width: "100%", padding: "12px 40px 12px 12px", borderRadius: 12,
                    border: `1px solid ${C.border}`, background: C.surface,
                    color: C.white, fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                />
                <button onClick={() => setShowPassphraseText(!showPassphraseText)} style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: C.gray, padding: 4,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPassphraseText ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
              <p style={{ fontSize: 11, color: C.gray, marginTop: 6 }}>Leave blank if you never set one. Different passphrase opens a different wallet.</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <div style={{ position: "relative" }}>
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Enter your private key (WIF format)"
              style={{
                width: "100%", padding: "16px 44px 16px 14px", borderRadius: 14,
                border: `1.5px solid ${inputFocused ? C.orange : C.border}`,
                background: C.surface, color: C.white, fontSize: 14,
                fontFamily: "'SF Mono', monospace", outline: "none", boxSizing: "border-box",
              }}
            />
            {!input.trim() && (
              <button onClick={handlePaste} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: C.orange, padding: 4,
              }} title="Paste">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            )}
          </div>
          <span style={{ fontSize: 11, color: C.gray, marginTop: 6, display: "block" }}>Starts with K or L</span>
        </div>
      )}

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)", borderRadius: 12, padding: "12px 16px",
          marginBottom: 16, fontSize: 13, color: C.red, lineHeight: 1.5,
          border: "1px solid rgba(239,68,68,0.15)",
        }}>{error}</div>
      )}

      <button onClick={handleContinue} disabled={!input.trim()} style={{
        width: "100%", padding: "16px", borderRadius: 14, border: "none",
        cursor: input.trim() ? "pointer" : "not-allowed",
        background: input.trim() ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` : "#1A1A1A",
        fontSize: 16, fontWeight: 700,
        color: input.trim() ? C.bg : "#525252",
        boxShadow: input.trim() ? "0 4px 20px rgba(247,147,26,0.25)" : "none",
      }}>
        Restore Wallet
      </button>
    </>
  );

  // Detecting step UI
  const renderDetectingStep = () => (
    <div style={{ textAlign: "center", padding: "50px 0" }}>
      <Stepper />
      <div style={{
        width: 80, height: 80, borderRadius: "50%", position: "relative",
        margin: "0 auto 28px",
      }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${C.orange}20` }} />
        <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `2px solid ${C.orange}40`, animation: "pulse 2s ease infinite" }} />
        <div style={{ position: "absolute", inset: 12, borderRadius: "50%", border: `2px solid ${C.orange}60`, animation: "pulse 2s ease 0.3s infinite" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 8 }}>
        {t("lookingForBitcoin")}
      </h2>
      <p style={{ fontSize: 13, color: C.gray, marginBottom: 20 }}>
        {t("checking4Formats")}
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {[1, 2, 3, 4].map(d => (
          <div key={d} style={{
            width: 8, height: 8, borderRadius: 4,
            background: detectProgress >= d ? C.orange : C.border,
            transition: "all 0.3s",
          }} />
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.5; transform: scale(0.95) } }`}</style>
    </div>
  );

  // Address selection step UI
  const renderSelectStep = () => (
    <>
      <Stepper />
      {!isMobileDevice() && <button onClick={() => { setStep("input"); setAddresses(null); setAddressBalances({}); }} style={{
        background: "none", border: "none", color: C.gray, fontSize: 14,
        cursor: "pointer", marginBottom: 20, padding: "8px 0",
      }}>← {t("back")}</button>}

      <h2 style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 8 }}>{t("selectWalletType")}</h2>
      <p style={{ fontSize: 14, color: C.gray, marginBottom: 24, lineHeight: 1.6 }}>
        {t("multipleFormats")}
      </p>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)", borderRadius: 12, padding: "12px 16px",
          marginBottom: 16, fontSize: 14, color: C.red, lineHeight: 1.5,
          border: "1px solid rgba(239,68,68,0.2)",
        }}>{error}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {Object.entries(addresses || {}).map(([key, data]) => {
          const config = ADDRESS_TYPES[key];
          const isSelected = selectedType === key;
          const isError = data.error;
          const balance = addressBalances[key];
          const hasBalance = balance > 0;

          return (
            <button
              key={key}
              onClick={() => !isError && setSelectedType(key)}
              disabled={isError}
              style={{
                background: isSelected ? "rgba(247,147,26,0.08)" : C.surface,
                border: `2px solid ${isSelected ? C.orange : isError ? C.red : C.border}`,
                borderRadius: 14, padding: "16px",
                cursor: isError ? "not-allowed" : "pointer",
                textAlign: "left",
                opacity: isError ? 0.5 : 1,
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.white }}>
                      {config.name.replace(' (P2PKH)', '').replace(' (P2SH-P2WPKH)', '').replace(' (P2WPKH)', '').replace(' (P2TR)', '')}
                    </span>
                    {hasBalance && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: C.bg, background: C.green,
                        padding: "3px 8px", borderRadius: 6,
                      }}>{formatBalance(balance)}</span>
                    )}
                    {config.recommended && !hasBalance && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: C.gray, background: C.border,
                        padding: "2px 6px", borderRadius: 6,
                      }}>{t("lowestFees")}</span>
                    )}
                  </div>
                  {!isError && data.address && (
                    <div style={{
                      fontSize: 12, fontFamily: "'SF Mono', monospace", color: C.grayLight,
                      wordBreak: "break-all",
                    }}>
                      {data.address.slice(0, 20)}...{data.address.slice(-8)}
                    </div>
                  )}
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: `2px solid ${isSelected ? C.orange : C.border}`,
                  background: isSelected ? C.orange : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginLeft: 12,
                }}>
                  {isSelected && <span style={{ color: C.bg, fontSize: 13 }}>✓</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 13, color: C.gray, marginBottom: 20, textAlign: "center" }}>
        {t("notSureSegwit")}
      </p>

      <button onClick={() => handleSaveAddress()} disabled={saving} style={{
        width: "100%", padding: "18px", borderRadius: 14, border: "none",
        cursor: "pointer",
        background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
        fontSize: 17, fontWeight: 700, color: C.bg,
        opacity: saving ? 0.7 : 1,
      }}>
        {saving ? t("importing") : t("continue")}
      </button>
    </>
  );

  // Saving step
  const renderSavingStep = () => (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", background: C.surface,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px", border: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 32, height: 32, border: `3px solid ${C.border}`,
          borderTopColor: C.orange, borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 8 }}>
        {t("securingWallet")}
      </h2>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Success step
  const renderSuccessStep = () => (
    <div style={{ textAlign: "center", padding: "50px 0", position: "relative" }}>
      {/* Confetti particles */}
      {[...Array(14)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: "50%", top: "30%",
          width: 6, height: 6,
          borderRadius: i % 2 === 0 ? "50%" : 1,
          background: [C.orange, "#FFD700", C.green, "#FF6B35", "#FFE066"][i % 5],
          animation: `confetti-${i % 7} 1s ease-out forwards`,
          opacity: 0,
        }} />
      ))}

      <div style={{
        width: 80, height: 80, borderRadius: 24, margin: "0 auto 24px",
        background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "successPop 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>

      <h2 style={{ fontSize: 26, fontWeight: 900, color: C.white, marginBottom: 6 }}>
        {t("welcomeBack")}
      </h2>
      <p style={{ fontSize: 14, color: C.gray, marginBottom: 24 }}>
        {t("walletIsReady")}
      </p>

      {detectedBalance > 0 && (
        <div style={{
          background: C.surface, borderRadius: 16, padding: "16px 20px",
          border: `1px solid ${C.border}`, display: "inline-block",
          animation: "fadeUp 0.4s ease 0.3s both",
        }}>
          <div style={{ fontSize: 11, color: C.gray, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("balanceFound")}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green, fontFamily: "'SF Mono', monospace" }}>
            {formatBalance(detectedBalance)}
          </div>
        </div>
      )}

      <style>{`
        @keyframes successPop { 0% { transform: scale(0.5); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes fadeUp { 0% { transform: translateY(10px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        ${[...Array(7)].map((_, i) => {
          const angle = (i / 7) * 360;
          const dist = 60 + Math.random() * 40;
          const tx = Math.cos(angle * Math.PI / 180) * dist;
          const ty = Math.sin(angle * Math.PI / 180) * dist;
          return `@keyframes confetti-${i} { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(${tx}px,${ty}px) scale(0); opacity: 0; } }`;
        }).join('\n')}
      `}</style>
    </div>
  );

  return (
    <div style={{
      height: "100dvh", background: C.bg, display: "flex",
      flexDirection: "column",
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      overflow: "hidden",
    }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "16px 24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", margin: "0 auto" }}>
        {step === "input" && !isMobileDevice() && (
          <button onClick={onBack} style={{
            background: "none", border: "none", color: C.gray, fontSize: 14,
            cursor: "pointer", marginBottom: 20, padding: "8px 0",
          }}>← {t("back")}</button>
        )}

        {step === "input" && renderInputStep()}
        {step === "detecting" && renderDetectingStep()}
        {step === "select" && renderSelectStep()}
        {step === "saving" && renderSavingStep()}
        {step === "success" && renderSuccessStep()}
      </div>
    </div>
  );
}
