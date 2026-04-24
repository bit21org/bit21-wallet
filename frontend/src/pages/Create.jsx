import { useState, useEffect, useRef } from "react";
import { generateSeedPhrase, addressFromSeed, getBIP39Wordlist } from "../lib/bitcoin.js";
import { getUserFriendlyError } from "../lib/errors.js";
import { t } from "../lib/i18n.js";
import { isMobileDevice } from "../App.jsx";
import { enableScreenSecurity, disableScreenSecurity } from "../lib/native-push.js";

export default function Create({ onDone, onBack }) {
  // Block screenshots while seed phrase is visible
  useEffect(() => { enableScreenSecurity(); return () => disableScreenSecurity(); }, []);
  // Mainnet only
  const testnet = false;
  const [step, setStep] = useState(1); // 1=intro, 2=phrase, "verify"=quiz, 3=saving, 4=success
  const stepRef = useRef(1);
  useEffect(() => { stepRef.current = step; });
  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; });

  useEffect(() => {
    window._bit21CreateBack = () => {
      const s = stepRef.current;
      if (s === "verify") { setStep(2); return "step"; }
      if (s === 2) { setStep(1); return "step"; }
      if (s === 1) { onBackRef.current(); return "exit"; }
      return false;
    };
    return () => { delete window._bit21CreateBack; };
  }, []);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [seedWords, setSeedWords] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordCount, setWordCount] = useState(12); // 12 or 24
  // Verification state: 3 random word positions + picked answers
  const [verifyQuiz, setVerifyQuiz] = useState([]); // [{idx, choices:[4 words], picked:null}]
  const [verifyError, setVerifyError] = useState("");
  const [savedAddress, setSavedAddress] = useState(""); // derived address for current seed

  const buildQuiz = (words) => {
    const wordlist = getBIP39Wordlist();
    const n = words.length;
    // Pick 3 distinct random positions
    const picks = new Set();
    while (picks.size < 3) picks.add(Math.floor(Math.random() * n));
    const positions = Array.from(picks).sort((a, b) => a - b);
    return positions.map(idx => {
      const correct = words[idx];
      const decoys = new Set();
      while (decoys.size < 3) {
        const w = wordlist[Math.floor(Math.random() * wordlist.length)];
        if (w !== correct) decoys.add(w);
      }
      const choices = [correct, ...decoys].sort(() => Math.random() - 0.5);
      return { idx, correct, choices, picked: null };
    });
  };

  const C = {
    bg: "#0D0D0D", surface: "#141414", border: "#1F1F1F", borderLight: "#2A2A2A",
    orange: "#F7931A", orangeDark: "#D4780E", white: "#FAFAFA",
    gray: "#737373", grayLight: "#A3A3A3", red: "#EF4444", green: "#22C55E",
    amber: "#F59E0B", amberDark: "#B45309",
    amberBg: "rgba(251, 191, 36, 0.1)", amberBorder: "rgba(251, 191, 36, 0.3)",
  };

  // Derive the address locally — seed never leaves the device
  const deriveLocal = async (mnemonic) => {
    try {
      const { address } = await addressFromSeed(mnemonic, testnet);
      setSavedAddress(address);
      setError("");
      return address;
    } catch (err) {
      setError(getUserFriendlyError(err));
      return null;
    }
  };

  const handleGenerate = () => {
    const strength = wordCount === 24 ? 256 : 128;
    const mnemonic = generateSeedPhrase(strength);
    setSeedPhrase(mnemonic);
    const words = mnemonic.split(" ");
    setSeedWords(words);
    setCopied(false);
    setSavedAddress("");
    setError("");
    setStep(2);
    // Derive address locally in background — no network call
    deriveLocal(mnemonic);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(seedPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Auto-clear clipboard after 15 minutes for security
      setTimeout(() => { try { navigator.clipboard.writeText(""); } catch {} }, 900000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = seedPhrase;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContinueToVerify = async () => {
    let addr = savedAddress;
    if (!addr) {
      addr = await deriveLocal(seedPhrase);
      if (!addr) return;
    }
    setVerifyQuiz(buildQuiz(seedWords));
    setVerifyError("");
    setStep("verify");
  };

  const handleVerifySubmit = () => {
    setVerifyError("");
    const allCorrect = verifyQuiz.every(q => q.picked === q.correct);
    if (!allCorrect) {
      setVerifyError("Some answers are incorrect. Please check your recovery phrase and try again.");
      return;
    }
    setStep(4);
    setTimeout(() => onDone(savedAddress, seedPhrase), 1500);
  };

  // Step 1: Intro — centered
  if (step === 1) {
    return (
      <div style={{
        height: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif", overflow: "hidden",
      }}>
        <div style={{ width: "100%", maxWidth: 380, padding: "0 28px", textAlign: "center" }}>
          <button onClick={onBack} style={{
            background: "none", border: "none", color: C.gray, fontSize: 14,
            cursor: "pointer", marginBottom: 24, padding: 0, display: "block",
          }}>← {t("back")}</button>
          <img src="/icons/icon-192.png" width={72} height={72} alt="bit21" style={{
            borderRadius: 20, margin: "0 auto 24px", display: "block",
            boxShadow: `0 8px 32px rgba(247,147,26,0.3)`,
          }} />
          <h2 style={{ fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 12 }}>
            {t("createNewWallet")}
          </h2>
          <p style={{ fontSize: 15, color: C.gray, marginBottom: 28, lineHeight: 1.7, maxWidth: 320, margin: "0 auto 28px" }}>
{`We'll generate a ${wordCount}-word recovery phrase. This is the only way to restore your wallet.`}
          </p>

          {/* 12/24 Word Switcher */}
          <div style={{
            display: "inline-flex", background: C.surface, borderRadius: 12, padding: 3,
            border: `1px solid ${C.border}`, marginBottom: 24,
          }}>
            {[12, 24].map(n => (
              <button key={n} onClick={() => setWordCount(n)} style={{
                padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 700, transition: "all 0.2s",
                background: wordCount === n ? C.orange : "transparent",
                color: wordCount === n ? C.bg : C.grayLight,
              }}>
                {n} Words
              </button>
            ))}
          </div>

          <button onClick={handleGenerate} style={{
            width: "100%", padding: "18px", borderRadius: 14, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
            fontSize: 17, fontWeight: 700, color: C.bg,
            boxShadow: `0 4px 20px rgba(247,147,26,0.25)`,
          }}>{t("getStarted")}</button>
        </div>
      </div>
    );
  }

  // Step 3: Saving — centered spinner
  if (step === 3) {
    return (
      <div style={{
        height: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
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
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white }}>{t("creatingWallet")}</h2>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Step 4: Success — centered checkmark
  if (step === 4) {
    return (
      <div style={{
        height: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: "0 auto 24px",
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, color: C.green,
          }}>✓</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 8 }}>{t("allSet")}</h2>
          <p style={{ fontSize: 15, color: C.gray }}>{t("walletReady")}</p>
        </div>
      </div>
    );
  }

  // Step "verify": Backup verification — tap the correct word for 3 random positions
  if (step === "verify") {
    const allPicked = verifyQuiz.length > 0 && verifyQuiz.every(q => q.picked !== null);
    return (
      <div style={{
        height: "100dvh", background: C.bg,
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
        overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          padding: "0 20px",
          width: "100%", maxWidth: 420,
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}>
          <button onClick={() => setStep(2)} style={{
            background: "none", border: "none", color: C.gray, fontSize: 14,
            cursor: "pointer", padding: "16px 0 0", display: "block",
          }}>← {t("back")}</button>

          <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, margin: "0 auto 16px",
              background: `linear-gradient(135deg, ${C.green}20, ${C.green}08)`,
              border: `1px solid ${C.green}25`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: C.white, marginBottom: 6, letterSpacing: "-0.02em" }}>
              Verify your backup
            </h2>
            <p style={{ fontSize: 13, color: C.gray, lineHeight: 1.5, maxWidth: 320, margin: "0 auto" }}>
              Select the correct word for each position to confirm you've saved your phrase.
            </p>
          </div>

          {verifyQuiz.map((q, qi) => (
            <div key={q.idx} style={{
              background: C.surface, borderRadius: 16, padding: 16,
              border: `1px solid ${C.border}`, marginBottom: 12,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 10,
              }}>
                Word #{q.idx + 1}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {q.choices.map((w, wi) => {
                  const isPicked = q.picked === w;
                  const isWrong = isPicked && w !== q.correct;
                  const isRight = isPicked && w === q.correct;
                  return (
                    <button key={wi} onClick={() => {
                      setVerifyQuiz(prev => prev.map((pq, pi) => pi === qi ? { ...pq, picked: w } : pq));
                      setVerifyError("");
                    }} style={{
                      padding: "12px 10px", borderRadius: 10, cursor: "pointer",
                      background: isRight ? `${C.green}15` : isWrong ? `${C.red}15` : C.bg,
                      border: `1px solid ${isRight ? C.green + "50" : isWrong ? C.red + "50" : C.border}`,
                      color: isRight ? C.green : isWrong ? C.red : C.white,
                      fontSize: 14, fontWeight: 700,
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      transition: "all 0.15s",
                    }}>
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ height: 8 }} />
        </div>

        <div style={{
          flexShrink: 0, padding: "8px 20px 16px",
          background: C.bg, width: "100%", maxWidth: 420,
        }}>
          {verifyError && (
            <div style={{
              background: "rgba(239,68,68,0.08)", borderRadius: 10, padding: "10px 14px",
              marginBottom: 8, fontSize: 13, color: C.red, lineHeight: 1.4,
              border: "1px solid rgba(239,68,68,0.2)",
            }}>{verifyError}</div>
          )}
          <button onClick={handleVerifySubmit} disabled={!allPicked} style={{
            width: "100%", padding: "15px", borderRadius: 14, border: "none",
            cursor: allPicked ? "pointer" : "not-allowed",
            background: allPicked ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` : "#1A1A1A",
            fontSize: 15, fontWeight: 700,
            color: allPicked ? C.bg : "#525252",
            boxShadow: allPicked ? `0 4px 20px rgba(247,147,26,0.25)` : "none",
            transition: "all 0.2s ease",
          }}>
            Verify & Create Wallet
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Seed phrase — premium design
  return (
    <div style={{
      height: "100dvh", background: C.bg,
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "0 20px",
        width: "100%", maxWidth: 420,
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
      }}>
        {/* Back */}
        <button onClick={() => setStep(1)} style={{
          background: "none", border: "none", color: C.gray, fontSize: 14,
          cursor: "pointer", padding: "16px 0 0", display: "block",
        }}>← {t("back")}</button>

        {/* Header section */}
        <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${C.orange}20, ${C.orange}08)`,
            border: `1px solid ${C.orange}25`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 6, letterSpacing: "-0.02em" }}>
            {t("yourRecoveryPhrase")}
          </h2>
          <p style={{ fontSize: 13, color: C.gray, lineHeight: 1.5, maxWidth: 300, margin: "0 auto" }}>
            {t("writeDownWords")}
          </p>
        </div>

        {/* Seed phrase card */}
        <div style={{
          background: `linear-gradient(165deg, ${C.surface}, ${C.bg})`,
          borderRadius: 20, padding: "16px 14px 14px",
          border: `1px solid ${C.border}`,
          marginBottom: 14, position: "relative",
          boxShadow: `0 4px 24px rgba(0,0,0,0.2)`,
        }}>
          {/* Card header — word count + copy */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {seedWords.length} {t("words")||"words"}
            </span>
            <button onClick={handleCopy} className="b21p" style={{
              background: copied ? `${C.green}15` : "transparent", border: `1px solid ${copied ? C.green+"30" : C.border}`,
              borderRadius: 8, cursor: "pointer", padding: "5px 10px",
              display: "flex", alignItems: "center", gap: 5,
              color: copied ? C.green : C.grayLight, fontSize: 11, fontWeight: 600,
              transition: "all 0.2s",
            }}>
              {copied ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Two columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {seedWords.map((word, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 0,
                background: C.bg, borderRadius: 10, padding: "11px 12px",
                border: `1px solid ${C.border}`,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: C.orange, width: 22, flexShrink: 0,
                  fontFamily: "'SF Mono', monospace", opacity: 0.7,
                }}>{i + 1}.</span>
                <span style={{
                  fontSize: seedWords.length > 12 ? 14 : 16, fontWeight: 700, color: C.white,
                  fontFamily: "'SF Mono', 'Fira Code', monospace", letterSpacing: "0.01em",
                }}>{word}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warning — minimal, inline */}
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "10px 14px", borderRadius: 12,
          background: `rgba(251,191,36,0.06)`, border: `1px solid rgba(251,191,36,0.12)`,
          marginBottom: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          <p style={{ fontSize: 11, color: "#D4A017", lineHeight: 1.5, margin: 0 }}>
            {t("keepItSecretDesc")}
          </p>
        </div>

        {/* Confirm checkbox */}
        <label style={{
          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
          padding: "6px 0 16px",
        }}>
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
            style={{ accentColor: C.orange, width: 18, height: 18, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: C.grayLight, lineHeight: 1.4 }}>
            {t("savedMyPhrase")}
          </span>
        </label>
      </div>

      {/* Fixed bottom button */}
      <div style={{
        flexShrink: 0, padding: "8px 20px 16px",
        background: C.bg, width: "100%", maxWidth: 420,
      }}>
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)", borderRadius: 10, padding: "10px 14px",
            marginBottom: 8, fontSize: 13, color: C.red, lineHeight: 1.4,
            border: "1px solid rgba(239,68,68,0.2)",
          }}>{error}</div>
        )}

        <button onClick={handleContinueToVerify} disabled={!confirmed} style={{
          width: "100%", padding: "15px", borderRadius: 14, border: "none",
          cursor: confirmed ? "pointer" : "not-allowed",
          background: confirmed ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` : "#1A1A1A",
          fontSize: 15, fontWeight: 700,
          color: confirmed ? C.bg : "#525252",
          boxShadow: confirmed ? `0 4px 20px rgba(247,147,26,0.25)` : "none",
          transition: "all 0.2s ease",
        }}>
          {t("continue")}
        </button>
      </div>
    </div>
  );
}
