import { useState, useEffect, useRef } from "react";
import Create from "./pages/Create.jsx";
import Import from "./pages/Import.jsx";
import Wallet from "./pages/Wallet.jsx";
import { hashPIN, getAddressType, addressTypeIdToKey, ADDRESS_TYPES, deriveAddress } from "./lib/bitcoin.js";
import { isBiometricRegistered, authenticateBiometric } from "./lib/biometric.js";
import { initCryptoKey, encryptSeed, decryptSeed } from "./lib/crypto-storage.js";
import { updateFCMAddress } from "./lib/native-push.js";
import { t } from "./lib/i18n.js";

// Detect mobile (native app or mobile browser) — hide back buttons on mobile
export const isMobileDevice = () => {
  if (window.Capacitor?.isNativePlatform?.()) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

// ══════════════════════════════════════════════════════════════
// INTRO SCREENS — First launch experience
// ══════════════════════════════════════════════════════════════

function getIntroScreens() {
  return [
    {
      headline: t("introHeadline1"),
      sub: t("introSub1"),
      visual: "shield",
      accent: "#F7931A",
    },
    {
      headline: t("introHeadline2"),
      sub: t("introSub2"),
      visual: "stack",
      accent: "#F7931A",
    },
    {
      headline: t("introHeadline3"),
      sub: t("introSub3"),
      visual: "vault",
      accent: "#F7931A",
    },
  ];
}

function IntroScreens({ onDone }) {
  const INTRO_SCREENS = getIntroScreens();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const touchRef = useRef({ startX: 0, startY: 0 });

  const goTo = (idx) => {
    if (idx === current) return;
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
    setAnimKey(k => k + 1);
  };

  const next = () => {
    if (current < INTRO_SCREENS.length - 1) goTo(current + 1);
    else finish();
  };

  const prev = () => {
    if (current > 0) goTo(current - 1);
  };

  const finish = () => {
    localStorage.setItem("bit21_intro_seen", "1");
    onDone();
  };

  const handleTouchStart = (e) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }
  };

  const s = INTRO_SCREENS[current];
  const isLast = current === INTRO_SCREENS.length - 1;

  // Visual illustrations
  const renderVisual = (type, accent) => {
    const common = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };
    if (type === "shield") return (
      <div style={{ ...common, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* bit21 logo with glow rings */}
        <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Outer glow rings */}
          <div style={{ position: "absolute", inset: -30, borderRadius: "50%", background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)`, animation: "intro-pulse 3s ease infinite" }} />
          <div style={{ position: "absolute", inset: -15, borderRadius: "50%", background: `radial-gradient(circle, ${accent}10 0%, transparent 60%)`, animation: "intro-pulse 3s ease 0.5s infinite" }} />
          {/* Logo image */}
          <img src="/icons/icon-192.png" width={100} height={100} alt="bit21" style={{ position: "relative", zIndex: 2, borderRadius: 24, boxShadow: `0 12px 40px ${accent}40` }} />
          {/* Floating particles */}
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              position: "absolute",
              width: 4 + i * 2, height: 4 + i * 2,
              borderRadius: "50%",
              background: accent,
              opacity: 0.15 + i * 0.05,
              top: `${15 + i * 18}%`, left: `${10 + i * 20}%`,
              animation: `intro-float ${3 + i * 0.7}s ease-in-out ${i * 0.4}s infinite`,
            }} />
          ))}
        </div>
      </div>
    );

    if (type === "stack") return (
      <div style={{ ...common, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 200, height: 160 }}>
          {/* Stacked cards representing multiple wallets */}
          {[2, 1, 0].map(i => (
            <div key={i} style={{
              position: "absolute",
              width: 160 - i * 10, height: 90,
              left: "50%", top: "50%",
              transform: `translate(-50%, -50%) translateY(${(i - 1) * -16}px) rotate(${(i - 1) * -3}deg)`,
              borderRadius: 16,
              background: i === 0 ? `linear-gradient(135deg, ${accent}30, ${accent}10)` : `linear-gradient(135deg, #ffffff08, #ffffff03)`,
              border: `1px solid ${i === 0 ? accent + "50" : "#ffffff12"}`,
              backdropFilter: "blur(20px)",
              padding: 14,
              animation: `intro-card-${i} 0.8s ease-out ${0.1 + i * 0.15}s both`,
            }}>
              {i === 0 && <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: accent }} />
                  <div style={{ height: 6, width: 50, borderRadius: 3, background: "#ffffff20" }} />
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "#fff", opacity: 0.9 }}>0.04821700</div>
                <div style={{ fontSize: 10, color: "#ffffff50", marginTop: 2 }}>bc1q•••f7k2</div>
              </>}
              {i === 1 && <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: "#F7931A" }} />
                  <div style={{ height: 6, width: 40, borderRadius: 3, background: "#ffffff15" }} />
                </div>
                <div style={{ height: 10, width: 80, borderRadius: 5, background: "#ffffff10", marginTop: 6 }} />
              </>}
            </div>
          ))}
          {/* Lock icon floating */}
          <div style={{
            position: "absolute", bottom: -10, right: 10,
            width: 36, height: 36, borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}, ${accent}80)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 24px ${accent}40`,
            animation: "intro-float 4s ease-in-out infinite",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        </div>
      </div>
    );

    if (type === "vault") return (
      <div style={{ ...common, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 200, height: 200 }}>
          {/* Outer time ring */}
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: "absolute", top: 0, left: 0, animation: "intro-vault-ring 12s linear infinite" }}>
            <defs>
              <linearGradient id="vaultRingGrad" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={accent} stopOpacity="0.4"/>
                <stop offset="50%" stopColor={accent} stopOpacity="0.05"/>
                <stop offset="100%" stopColor={accent} stopOpacity="0.4"/>
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="95" fill="none" stroke="url(#vaultRingGrad)" strokeWidth="1.5" strokeDasharray="8 6"/>
          </svg>
          {/* Inner glow */}
          <div style={{ position: "absolute", inset: 30, borderRadius: "50%", background: `radial-gradient(circle, ${accent}12 0%, transparent 70%)`, animation: "intro-pulse 4s ease infinite" }} />
          {/* Vault body */}
          <svg width="120" height="130" viewBox="0 0 120 130" fill="none" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 2 }}>
            <defs>
              <linearGradient id="vaultBodyGrad" x1="60" y1="0" x2="60" y2="130" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={accent} stopOpacity="0.2"/>
                <stop offset="100%" stopColor={accent} stopOpacity="0.05"/>
              </linearGradient>
            </defs>
            {/* Vault box */}
            <rect x="10" y="30" width="100" height="85" rx="12" fill="url(#vaultBodyGrad)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.4"/>
            {/* Vault door circle */}
            <circle cx="60" cy="72" r="28" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5"/>
            <circle cx="60" cy="72" r="20" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.25"/>
            {/* Lock handle */}
            <path d="M45 58L60 50L75 58" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
            {/* Dial ticks */}
            {[0,45,90,135,180,225,270,315].map((deg, i) => {
              const r1 = 24, r2 = 28;
              const rad = deg * Math.PI / 180;
              return <line key={i} x1={60 + r1 * Math.cos(rad)} y1={72 + r1 * Math.sin(rad)} x2={60 + r2 * Math.cos(rad)} y2={72 + r2 * Math.sin(rad)} stroke={accent} strokeWidth="1.5" strokeOpacity="0.3"/>;
            })}
            {/* Lock icon on top */}
            <rect x="45" y="8" width="30" height="26" rx="6" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6"/>
            <path d="M52 22V18a8 8 0 0 1 16 0v4" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6" transform="translate(-3, -4) scale(0.8)"/>
            <circle cx="60" cy="24" r="2.5" fill={accent} fillOpacity="0.5"/>
          </svg>
          {/* Countdown floating badge */}
          <div style={{
            position: "absolute", bottom: 10, right: 5,
            background: "#141414", borderRadius: 10,
            padding: "6px 10px", border: `1px solid ${accent}30`,
            animation: "intro-float 3.5s ease-in-out 0.3s infinite",
          }}>
            <div style={{ fontSize: 8, color: "#999", fontWeight: 700 }}>UNLOCKS IN</div>
            <div style={{ fontSize: 13, color: accent, fontWeight: 800, fontFamily: "monospace" }}>89d 14h</div>
          </div>
          {/* Amount badge */}
          <div style={{
            position: "absolute", top: 15, left: -5,
            background: "#141414", borderRadius: 10,
            padding: "6px 10px", border: `1px solid ${accent}20`,
            animation: "intro-float 4s ease-in-out infinite",
          }}>
            <div style={{ fontSize: 8, color: "#999", fontWeight: 700 }}>LOCKED</div>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 800, fontFamily: "monospace" }}>0.5 BTC</div>
          </div>
          {/* Floating particles */}
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              position: "absolute",
              width: 3 + i, height: 3 + i,
              borderRadius: "50%", background: accent,
              opacity: 0.2 + i * 0.05,
              top: `${20 + i * 22}%`, right: `${5 + i * 15}%`,
              animation: `intro-float ${3 + i * 0.8}s ease-in-out ${i * 0.5}s infinite`,
            }} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        height: "100dvh", background: "#0D0D0D",
        display: "flex", flexDirection: "column",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
        position: "relative", overflow: "hidden",
        userSelect: "none",
        maxWidth: 480, margin: "0 auto", width: "100%",
      }}
    >
      {/* Skip button */}
      {!isLast && (
        <button onClick={finish} style={{
          position: "absolute", top: 16, right: 20, zIndex: 10,
          background: "none", border: "none", color: "#737373",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          padding: "8px 4px",
        }}>{t("skip")}</button>
      )}

      {/* Visual area — constrained so it doesn't push content off screen */}
      <div key={animKey} style={{
        flex: "1 1 0", position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
        maxHeight: "45%", minHeight: 0,
        animation: `intro-visual-in 0.5s ease-out both`,
      }}>
        {renderVisual(s.visual, s.accent)}
      </div>

      {/* Content area — pinned to bottom */}
      <div style={{
        padding: "0 28px 16px", position: "relative", zIndex: 2, flexShrink: 0,
      }}>
        {/* Headline */}
        <div key={`h-${animKey}`} style={{ animation: "intro-text-in 0.5s ease-out both" }}>
          <h1 style={{
            fontSize: 26, fontWeight: 900, color: "#FAFAFA",
            lineHeight: 1.15, letterSpacing: "-0.03em",
            marginBottom: 8, whiteSpace: "pre-line",
          }}>
            {s.headline.split("\n").map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {i === 0 ? line : <span style={{ color: s.accent }}>{line}</span>}
              </span>
            ))}
          </h1>
        </div>

        {/* Subtitle */}
        <div key={`s-${animKey}`} style={{ animation: "intro-text-in 0.5s ease-out 0.1s both" }}>
          <p style={{
            fontSize: 13, lineHeight: 1.5, color: "#A3A3A3",
            fontWeight: 500, marginBottom: 20, maxWidth: 320,
          }}>{s.sub}</p>
        </div>

        {/* Dots + Buttons */}
        <div key={`b-${animKey}`} style={{ animation: "intro-text-in 0.5s ease-out 0.2s both" }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {INTRO_SCREENS.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} style={{
                width: i === current ? 28 : 8, height: 8,
                borderRadius: 4, border: "none", cursor: "pointer",
                background: i === current ? s.accent : "#333",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>

          {/* Action button */}
          <button onClick={isLast ? finish : next} style={{
            width: "100%", padding: "14px 24px", borderRadius: 16,
            border: "none", cursor: "pointer",
            background: isLast
              ? `linear-gradient(135deg, ${s.accent}, ${s.accent}CC)`
              : "#1A1A1A",
            fontSize: 15, fontWeight: 800,
            color: isLast ? "#0D0D0D" : "#FAFAFA",
            boxShadow: isLast ? `0 8px 32px ${s.accent}40` : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.3s ease",
          }}>
            {isLast ? t("enterBit21") : t("continue")}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes intro-visual-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes intro-text-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes intro-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.05); } }
        @keyframes intro-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes intro-dash { to { stroke-dashoffset: -100; } }
        @keyframes intro-vault-ring { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes intro-card-0 { from { opacity: 0; transform: translate(-50%, -50%) translateY(20px); } to { opacity: 1; transform: translate(-50%, -50%) translateY(16px); } }
        @keyframes intro-card-1 { from { opacity: 0; transform: translate(-50%, -50%) translateY(10px) rotate(0deg); } to { opacity: 1; transform: translate(-50%, -50%) translateY(-16px) rotate(-3deg); } }
        @keyframes intro-card-2 { from { opacity: 0; transform: translate(-50%, -50%) translateY(0); } to { opacity: 1; transform: translate(-50%, -50%) translateY(-32px) rotate(-6deg); } }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// App — PIN lock, multi-wallet, routing
// ══════════════════════════════════════════════════════════════

function loadWallets() {
  let wallets = [];
  try {
    const data = localStorage.getItem("btc_wallets");
    if (data) wallets = JSON.parse(data);
  } catch {}
  // Migrate from old single-wallet format
  if (wallets.length === 0) {
    const oldAddr = localStorage.getItem("btc_wallet_address");
    if (oldAddr) {
      const w = { id: "w_" + Date.now(), name: "Wallet 1", address: oldAddr, createdAt: Date.now() };
      wallets = [w];
      localStorage.setItem("btc_active_wallet", w.id);
      localStorage.removeItem("btc_wallet_address");
    }
  }
  // Migrate v1 → v2: add addressType, primaryAddress, addresses fields
  let migrated = false;
  for (const w of wallets) {
    if (!w.addressType && w.address) {
      const typeId = getAddressType(w.address); // e.g. 'native-segwit'
      const typeKey = addressTypeIdToKey(typeId); // e.g. 'NATIVE_SEGWIT'
      w.addressType = typeKey;
      w.primaryAddress = w.address;
      w.addresses = [{ type: typeKey, address: w.address, path: ADDRESS_TYPES[typeKey]?.path?.mainnet || "", index: 0, isDefault: true }];
      w.nextIndex = { LEGACY: 1, SEGWIT_COMPAT: 1, NATIVE_SEGWIT: 1, TAPROOT: 1 };
      // Migrate vault storage from address-keyed to walletId-keyed
      const oldVaults = localStorage.getItem(`btc_vaults_${w.address}`);
      if (oldVaults && !localStorage.getItem(`btc_vaults_${w.id}`)) {
        localStorage.setItem(`btc_vaults_${w.id}`, oldVaults);
      }
      migrated = true;
    }
  }
  if (migrated || wallets.length > 0) {
    localStorage.setItem("btc_wallets", JSON.stringify(wallets));
  }
  return wallets;
}

function saveWallets(wallets) {
  localStorage.setItem("btc_wallets", JSON.stringify(wallets));
}

export default function App() {
  const [page, setPage] = useState("loading");
  const [wallets, setWallets] = useState([]);
  const [activeWalletId, setActiveWalletId] = useState(null);
  const [pinLocked, setPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [cryptoKey, setCryptoKey] = useState(null);
  const [walletKeyData, setWalletKeyData] = useState(null);

  // One-time migration: clear corrupt PIN hashes from old broken "Set PIN" button.
  // Old button called onSetPIN(event) passing React SyntheticEvent instead of PIN string.
  // The old PIN setup NEVER worked correctly, so any existing hash is corrupt.
  // After this migration, only the new numpad PIN flow (Session 16) creates valid hashes.
  if (!localStorage.getItem("btc_pin_migrated_v16")) {
    localStorage.removeItem("btc_pin_hash");
    localStorage.setItem("btc_pin_migrated_v16", "1");
  }
  // v17: PIN hash format changed (salted + 1000 rounds)
  if (!localStorage.getItem("btc_pin_migrated_v17")) {
    localStorage.removeItem("btc_pin_hash");
    localStorage.removeItem("btc_duress_pin_hash");
    localStorage.removeItem("btc_pin_salt");
    localStorage.setItem("btc_pin_migrated_v17", "1");
  }
  const pinHash = localStorage.getItem("btc_pin_hash");
  const hasPIN = !!pinHash;
  const activeWallet = wallets.find(w => w.id === activeWalletId);

  useEffect(() => {
    (async () => {
      const key = await initCryptoKey();
      setCryptoKey(key);

      const loaded = loadWallets();
      const activeId = localStorage.getItem("btc_active_wallet");
      setWallets(loaded);

      // Migrate old base64 seeds to AES-GCM encrypted format
      for (const w of loaded) {
        const sk = localStorage.getItem(`btc_sk_${w.id}`);
        if (sk && !sk.startsWith("enc_v1:")) {
          try {
            const plain = atob(sk);
            const encrypted = await encryptSeed(plain, key);
            localStorage.setItem(`btc_sk_${w.id}`, encrypted);
          } catch {}
        }
      }

      if (loaded.length > 0) {
        const targetId = activeId && loaded.find(w => w.id === activeId) ? activeId : loaded[0].id;
        setActiveWalletId(targetId);
        localStorage.setItem("btc_active_wallet", targetId);
        if (localStorage.getItem("btc_pin_hash")) {
          setPinLocked(true);
          setPage("pinlock");
        } else if (isBiometricRegistered() && localStorage.getItem("btc_bio_active") !== "0") {
          // Biometric lock — Wallet component will prompt on mount
          setPage("wallet");
        } else {
          setPage("wallet");
        }
      } else {
        // First time ever? Show intro screens
        if (!localStorage.getItem("bit21_intro_seen")) {
          setPage("intro");
        } else {
          setPage("onboarding");
        }
      }
    })();
  }, []);

  // ══ Browser Back Button System ══
  // Trap ALL back presses so we NEVER leave to bit21.app
  // On mount: replace current history + push a guard state
  useEffect(() => {
    window.history.replaceState({ bit21: true, page: "guard" }, "", window.location.pathname);
    window.history.pushState({ bit21: true, page: "app" }, "", window.location.pathname);
  }, []);

  // Re-push guard when page changes
  useEffect(() => {
    if (page === "loading") return;
    window.history.pushState({ bit21: true, page }, "", window.location.pathname);
  }, [page]);

  // popstate handler — this fires when browser back is pressed
  useEffect(() => {
    const onPopState = (e) => {
      if (page === "create") {
        if (window._bit21CreateBack) window._bit21CreateBack();
        else setPage("onboarding");
      } else if (page === "import") {
        if (window._bit21ImportBack) window._bit21ImportBack();
        else setPage("onboarding");
      } else if (page === "wallet") {
        window.history.pushState({ bit21: true, page }, "", window.location.pathname);
        if (window._bit21WalletBack) window._bit21WalletBack();
      } else if (page === "onboarding" && wallets.length > 0) {
        window.history.pushState({ bit21: true, page }, "", window.location.pathname);
        setPage("wallet");
      } else {
        window.history.pushState({ bit21: true, page }, "", window.location.pathname);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [page, wallets.length]);

  // Native app back button — uses refs so callback always has latest state
  const pageRef = useRef(page);
  const walletsRef = useRef(wallets);
  pageRef.current = page;
  walletsRef.current = wallets;

  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    let cleanup = null;
    (async () => {
      try {
        const { App: CapApp } = await import("@capacitor/app");
        const listener = await CapApp.addListener("backButton", () => {
          const p = pageRef.current;
          const w = walletsRef.current;
          if (p === "create") {
            if (window._bit21CreateBack) { window._bit21CreateBack(); }
            else { setPage(w.length > 0 ? "wallet" : "onboarding"); }
          } else if (p === "import") {
            if (window._bit21ImportBack) { window._bit21ImportBack(); }
            else { setPage(w.length > 0 ? "wallet" : "onboarding"); }
          } else if (p === "onboarding" && w.length > 0) {
            setPage("wallet");
          } else if (p === "wallet") {
            if (window._bit21WalletBack) window._bit21WalletBack();
          }
          // intro, pinlock, loading, onboarding (first time) — do nothing
        });
        cleanup = () => listener.remove();
      } catch {}
    })();
    return () => { cleanup?.(); };
  }, []); // Only register ONCE — uses refs for latest state

  // Decrypt seed when active wallet or crypto key changes
  useEffect(() => {
    if (!activeWalletId || !cryptoKey) { setWalletKeyData(null); return; }
    const sk = localStorage.getItem(`btc_sk_${activeWalletId}`);
    if (!sk) { setWalletKeyData(null); return; }
    decryptSeed(sk, cryptoKey)
      .then(plain => setWalletKeyData(plain))
      .catch(() => setWalletKeyData(null));
  }, [activeWalletId, cryptoKey]);

  // ── PIN handlers ──
  const handleSetPIN = (pin) => {
    localStorage.setItem("btc_pin_hash", hashPIN(pin));
  };

  const handleRemovePIN = () => {
    localStorage.removeItem("btc_pin_hash");
    localStorage.removeItem("btc_duress_pin_hash");
    localStorage.removeItem("btc_duress_wallet_id");
  };

  const handleSetDuress = (pin, walletId) => {
    localStorage.setItem("btc_duress_pin_hash", hashPIN(pin));
    localStorage.setItem("btc_duress_wallet_id", walletId);
  };

  const handleRemoveDuress = () => {
    localStorage.removeItem("btc_duress_pin_hash");
    localStorage.removeItem("btc_duress_wallet_id");
  };

  // ── Wallet CRUD ──
  const handleWalletReady = async (address, seedOrKey, discoveredAddrs, discoveredNextIdx) => {
    // Block duplicate empty wallets on same device — switch to existing instead
    const dup = findDuplicateEmpty(address);
    if (dup) {
      setActiveWalletId(dup.id);
      localStorage.setItem("btc_active_wallet", dup.id);
      setPage("wallet");
      return;
    }
    const typeId = getAddressType(address) || "native-segwit";
    const typeKey = addressTypeIdToKey(typeId);
    const newWallet = {
      id: "w_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: `Wallet ${wallets.length + 1}`,
      address,
      createdAt: Date.now(),
      addressType: typeKey,
      primaryAddress: address,
      addresses: [{ type: typeKey, address, path: ADDRESS_TYPES[typeKey]?.path?.mainnet || "", index: 0, isDefault: true }],
      nextIndex: { LEGACY: 1, SEGWIT_COMPAT: 1, NATIVE_SEGWIT: 1, TAPROOT: 1 },
    };

    // Merge discovered HD addresses from Import.jsx
    if (discoveredAddrs && discoveredAddrs.length > 0) {
      newWallet.addresses = [...newWallet.addresses, ...discoveredAddrs];
    }
    if (discoveredNextIdx) {
      newWallet.nextIndex = { ...newWallet.nextIndex, ...discoveredNextIdx };
    }

    // Store seed/key encrypted
    if (seedOrKey && cryptoKey) {
      try {
        const encrypted = await encryptSeed(seedOrKey, cryptoKey);
        localStorage.setItem(`btc_sk_${newWallet.id}`, encrypted);
      } catch {}
    }

    const updated = [...wallets, newWallet];
    setWallets(updated);
    setActiveWalletId(newWallet.id);
    saveWallets(updated);
    localStorage.setItem("btc_active_wallet", newWallet.id);
    setPage("wallet");
  };

  const handleDisconnect = (walletId) => {
    const id = walletId || activeWalletId;
    const target = wallets.find(w => w.id === id);
    const updated = wallets.filter(w => w.id !== id);
    setWallets(updated);
    saveWallets(updated);
    // Clean up per-wallet storage
    if (target) {
      try {
        localStorage.removeItem(`btc_sk_${id}`);
        localStorage.removeItem(`btc_vaults_${id}`);
        localStorage.removeItem(`btc_cache_${target.address}_false`);
        localStorage.removeItem(`btc_cache_${target.address}_true`);
      } catch {}
    }
    if (updated.length > 0) {
      setActiveWalletId(updated[0].id);
      localStorage.setItem("btc_active_wallet", updated[0].id);
      setPage("wallet");
    } else {
      setActiveWalletId(null);
      localStorage.removeItem("btc_active_wallet");
      setPage("onboarding");
    }
  };

  // Duplicate check: returns existing wallet if address already present AND empty on this device
  const findDuplicateEmpty = (addr) => {
    const existing = wallets.find(w => w.address === addr);
    if (!existing) return null;
    try {
      const cache = JSON.parse(localStorage.getItem(`btc_cache_${addr}_false`) || "null");
      const bal = cache?.balance?.total || 0;
      if (bal > 0) return null;
    } catch {}
    return existing;
  };

  const handleSwitchWallet = (id) => {
    setActiveWalletId(id);
    localStorage.setItem("btc_active_wallet", id);
  };

  const handleRenameWallet = (id, newName) => {
    const updated = wallets.map(w => w.id === id ? { ...w, name: newName } : w);
    setWallets(updated);
    saveWallets(updated);
  };

  const handleChangeAddressType = async (walletId, newTypeKey) => {
    const w = wallets.find(ww => ww.id === walletId);
    if (!w || w.watchOnly) return;
    // Get seed
    const sk = localStorage.getItem(`btc_sk_${walletId}`);
    if (!sk) return;
    let rawSeed2;
    try { rawSeed2 = sk.startsWith("enc_v1:") ? await decryptSeed(sk, cryptoKey) : atob(sk); } catch { return; }
    if (!rawSeed2) return;
    const ppIdx2 = rawSeed2.indexOf("\n__EXT__:");
    const seed = ppIdx2 >= 0 ? rawSeed2.substring(0, ppIdx2) : rawSeed2;
    const passphrase2 = ppIdx2 >= 0 ? rawSeed2.substring(ppIdx2 + 9) : "";
    // Find the default address for this type, or derive index 0 if first time
    let allAddrs = [...(w.addresses || [])];
    const typeAddrs = allAddrs.filter(a => a.type === newTypeKey);
    const existingDefault = typeAddrs.find(a => a.isDefault) || typeAddrs.find(a => a.index === 0);
    let newAddress;
    if (existingDefault) {
      newAddress = existingDefault.address;
    } else {
      const testnet = w.address?.startsWith("tb1") || w.address?.startsWith("m") || w.address?.startsWith("n") || w.address?.startsWith("2");
      const derived = await deriveAddress(seed, newTypeKey, testnet, 0, passphrase2);
      newAddress = derived.address;
      allAddrs = [...allAddrs, { type: newTypeKey, address: newAddress, path: derived.path, index: 0, isDefault: true }];
    }
    // Update active address — preserve all addresses and defaults
    const updated = wallets.map(ww => {
      if (ww.id !== walletId) return ww;
      return { ...ww, address: newAddress, addressType: newTypeKey, addresses: allAddrs };
    });
    setWallets(updated);
    saveWallets(updated);
    setWalletKeyData(rawSeed2); // ensure Wallet gets updated key (with passphrase embedded)
    updateFCMAddress(newAddress);
  };

  // Generate next HD address for current address type
  const handleGenerateAddress = async (walletId) => {
    const w = wallets.find(ww => ww.id === walletId);
    if (!w || w.watchOnly) return null;
    const sk = localStorage.getItem(`btc_sk_${walletId}`);
    if (!sk) return null;
    let rawSeed;
    try { rawSeed = sk.startsWith("enc_v1:") ? await decryptSeed(sk, cryptoKey) : atob(sk); } catch { return null; }
    if (!rawSeed) return null;
    const ppIdx = rawSeed.indexOf("\n__EXT__:");
    const seed = ppIdx >= 0 ? rawSeed.substring(0, ppIdx) : rawSeed;
    const passphrase = ppIdx >= 0 ? rawSeed.substring(ppIdx + 9) : "";
    const typeKey = w.addressType || "NATIVE_SEGWIT";
    const nextIdx = (w.nextIndex || {})[typeKey] || 1;
    if (nextIdx >= 20) return null; // cap at 20 addresses per type
    const testnet = w.address?.startsWith("tb1") || w.address?.startsWith("m") || w.address?.startsWith("n") || w.address?.startsWith("2");
    const derived = await deriveAddress(seed, typeKey, testnet, nextIdx, passphrase);
    const newEntry = { type: typeKey, address: derived.address, path: derived.path, index: nextIdx, isDefault: false, label: "", createdAt: Date.now() };
    // Ensure original address is in the list (defensive — migration may have missed it)
    let existingAddrs = [...(w.addresses || [])];
    if (!existingAddrs.find(a => a.address === w.address)) {
      existingAddrs = [{ type: typeKey, address: w.address, path: "", index: 0, isDefault: true }, ...existingAddrs];
    }
    const updated = wallets.map(ww => {
      if (ww.id !== walletId) return ww;
      const addrs = [...existingAddrs, newEntry];
      const ni = { ...(ww.nextIndex || {}), [typeKey]: nextIdx + 1 };
      return { ...ww, addresses: addrs, nextIndex: ni };
    });
    setWallets(updated);
    saveWallets(updated);
    return newEntry;
  };

  // Set a specific address as default (active) for its type
  const handleSetDefaultAddress = (walletId, addressStr) => {
    const w = wallets.find(ww => ww.id === walletId);
    if (!w) return;
    let addrs = [...(w.addresses || [])];
    // Ensure current address is in the list (defensive)
    if (!addrs.find(a => a.address === w.address)) {
      const typeKey = w.addressType || "NATIVE_SEGWIT";
      addrs = [{ type: typeKey, address: w.address, path: "", index: 0, isDefault: true }, ...addrs];
    }
    const entry = addrs.find(a => a.address === addressStr);
    if (!entry) return;
    const updated = wallets.map(ww => {
      if (ww.id !== walletId) return ww;
      const finalAddrs = addrs.map(a =>
        a.type === entry.type ? { ...a, isDefault: a.address === addressStr } : a
      );
      return { ...ww, address: addressStr, addresses: finalAddrs };
    });
    setWallets(updated);
    saveWallets(updated);
    updateFCMAddress(addressStr);
  };

  // Update label for an address
  const handleLabelAddress = (walletId, addressStr, label) => {
    const updated = wallets.map(ww => {
      if (ww.id !== walletId) return ww;
      const addrs = (ww.addresses || []).map(a => a.address === addressStr ? { ...a, label } : a);
      return { ...ww, addresses: addrs };
    });
    setWallets(updated);
    saveWallets(updated);
  };

  const handleAddWallet = () => setPage("onboarding");

  const handleWatchWallet = (addr) => {
    // Block duplicate empty wallets on same device — switch to existing instead
    const dup = findDuplicateEmpty(addr);
    if (dup) {
      setActiveWalletId(dup.id);
      localStorage.setItem("btc_active_wallet", dup.id);
      setPage("wallet");
      return { duplicate: true, existingName: dup.name };
    }
    const newWallet = {
      id: "w_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: `Watch ${wallets.length + 1}`,
      address: addr,
      createdAt: Date.now(),
      watchOnly: true,
    };
    const updated = [...wallets, newWallet];
    setWallets(updated);
    setActiveWalletId(newWallet.id);
    saveWallets(updated);
    localStorage.setItem("btc_active_wallet", newWallet.id);
    setPage("wallet");
    return { duplicate: false };
  };

  // ── Colors ──
  const C = {
    bg: "#0D0D0D", surface: "#141414", border: "#1F1F1F",
    orange: "#F7931A", orangeDark: "#D4780E", white: "#FAFAFA",
    gray: "#737373", grayLight: "#999999", red: "#EF4444", green: "#22C55E",
  };

  // ── Loading ──
  if (page === "loading") {
    return (
      <div style={{ height: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <img src="/icons/icon-192.png" width={48} height={48} alt="bit21" style={{
          borderRadius: 14,
          animation: "pulse 1.5s ease infinite",
        }} />
        <style>{`@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.6; transform: scale(0.95) } }`}</style>
      </div>
    );
  }

  // ── Intro Screens (first launch only) ──
  if (page === "intro") {
    return <IntroScreens onDone={() => setPage("onboarding")} />;
  }

  // Biometric lock is handled inside Wallet component via onBioLock prop

  // ── PIN Lock Screen ──
  if (page === "pinlock") {
    const numpadKeys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
    const hasBio = isBiometricRegistered();

    const handleNumpad = (key) => {
      if (key === "⌫") { setPinInput(p => p.slice(0, -1)); setPinError(""); }
      else if (key && pinInput.length < 6) {
        const next = pinInput + key;
        setPinInput(next);
        setPinError("");
        if (next.length >= 4) {
          const hash = hashPIN(next);
          const duressHash = localStorage.getItem("btc_duress_pin_hash");
          const duressWalletId = localStorage.getItem("btc_duress_wallet_id");
          if (duressHash && duressWalletId && hash === duressHash) {
            // Duress mode: load the decoy wallet
            setPinLocked(false);
            setPinInput("");
            setActiveWalletId(duressWalletId);
            localStorage.setItem("btc_active_wallet", duressWalletId);
            setPage("wallet");
          } else if (hash === localStorage.getItem("btc_pin_hash")) {
            setPinLocked(false);
            setPinInput("");
            setPage("wallet");
          } else if (next.length === 6) {
            setPinError(t("wrongPin"));
            setPinInput("");
          }
        }
      }
    };

    const handleBioUnlock = async () => {
      try {
        const ok = await authenticateBiometric();
        if (ok) { setPinLocked(false); setPinInput(""); setPage("wallet"); }
        else { setPinError(t("biometricFailedShort")); }
      } catch { setPinError(t("biometricFailedShort")); }
    };

    return (
      <div style={{
        height: "100dvh", background: C.bg, display: "flex",
        alignItems: "center", justifyContent: "center", overflow: "hidden",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
        maxWidth: 480, margin: "0 auto", width: "100%",
      }}>
        <div style={{ width: "100%", maxWidth: 320, padding: 24, textAlign: "center" }}>
          <img src="/icons/icon-192.png" width={56} height={56} alt="bit21" style={{
            borderRadius: 16, margin: "0 auto 20px", display: "block",
          }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 8 }}>{t("enterPin")}</h2>
          <p style={{ fontSize: 13, color: C.gray, marginBottom: 30 }}>{t("enterPinDesc")}</p>

          {/* PIN dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 10 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: 7,
                background: i < pinInput.length ? C.orange : "transparent",
                border: `2px solid ${i < pinInput.length ? C.orange : C.border}`,
                transition: "all 0.15s",
              }} />
            ))}
          </div>

          {pinError && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{pinError}</div>}

          {/* Numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 24 }}>
            {numpadKeys.map((key, i) => (
              <button key={i} onClick={() => handleNumpad(key)} disabled={!key} style={{
                height: 56, borderRadius: 14, border: "none",
                background: key ? C.surface : "transparent",
                color: C.white, fontSize: key === "⌫" ? 20 : 22, fontWeight: 700,
                cursor: key ? "pointer" : "default", opacity: key ? 1 : 0,
              }}>{key}</button>
            ))}
          </div>

          {/* Biometric unlock button */}
          {hasBio && (
            <button onClick={handleBioUnlock} style={{
              marginTop: 20, padding: "14px 28px", borderRadius: 14,
              border: `1px solid ${C.border}`, background: "transparent",
              color: C.gray, fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, width: "100%",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 10V4a2 2 0 1 1 4 0v6"/><path d="M8 10V6a2 2 0 1 1 4 0"/><path d="M16 10v-2a2 2 0 1 1 4 0v8a8 8 0 0 1-16 0V8a2 2 0 1 1 4 0"/></svg>
              {t("unlockBiometric")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Create / Import ──
  if (page === "create") {
    return <Create onDone={handleWalletReady} onBack={() => setPage(wallets.length > 0 ? "wallet" : "onboarding")} />;
  }
  if (page === "import") {
    return <Import onDone={handleWalletReady} onBack={() => setPage(wallets.length > 0 ? "wallet" : "onboarding")} />;
  }

  // ── Wallet ──
  if (page === "wallet" && activeWallet) {
    return (
      <Wallet
        address={activeWallet.address}
        walletName={activeWallet.name}
        wallets={wallets}
        activeWalletId={activeWalletId}
        activeWallet={activeWallet}
        hasPIN={hasPIN}
        onDisconnect={handleDisconnect}
        onDeleteWallet={handleDisconnect}
        onSwitchWallet={handleSwitchWallet}
        onRenameWallet={handleRenameWallet}
        onSetPIN={handleSetPIN}
        onRemovePIN={handleRemovePIN}
        onSetDuress={handleSetDuress}
        onRemoveDuress={handleRemoveDuress}
        onAddWallet={handleAddWallet}
        onImportWallet={() => setPage("import")}
        onWatchWallet={handleWatchWallet}
        onChangeAddressType={handleChangeAddressType}
        onGenerateAddress={handleGenerateAddress}
        onSetDefaultAddress={handleSetDefaultAddress}
        onLabelAddress={handleLabelAddress}
        isWatchOnly={!!activeWallet.watchOnly}
        walletKeyData={walletKeyData}
      />
    );
  }

  // ── Onboarding — Import-first funnel ──
  return (
    <div style={{
      height: "100dvh", background: C.bg, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      position: "relative", overflow: "hidden",
      maxWidth: 480, margin: "0 auto", width: "100%",
    }}>
      {/* Ambient glow */}
      <div style={{position:"absolute",top:"25%",left:"50%",transform:"translateX(-50%)",width:450,height:450,borderRadius:"50%",background:"radial-gradient(circle,rgba(247,147,26,0.12) 0%,rgba(247,147,26,0.03) 40%,transparent 70%)",pointerEvents:"none",animation:"ob-glow 6s ease-in-out infinite"}}/>

      <div style={{ width: "100%", maxWidth: 360, padding: "0 32px", textAlign: "center", position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>

        {/* ── Logo + Name + Subtitle ── */}
        <div style={{animation:"ob-rise 0.6s ease-out both",marginBottom:20}}>
          <div style={{position:"relative",display:"inline-block",marginBottom:10}}>
            <img src="/icons/icon-192.png" width={56} height={56} alt="bit21" style={{
              borderRadius: 16,
              boxShadow: `0 12px 40px rgba(247,147,26,0.35)`,
            }} />
          </div>
          <div style={{fontSize:26,fontWeight:900,color:C.white,letterSpacing:"-0.03em",lineHeight:1}}>
            bit<span style={{color:C.orange}}>21</span>
          </div>
          <div style={{fontSize:12,color:"#A3A3A3",fontWeight:500,marginTop:5,letterSpacing:"0.04em"}}>
            {t("holdBitcoin")}
          </div>
        </div>

        {/* ── Tagline ── */}
        <div style={{animation:"ob-rise 0.6s ease-out 0.08s both",marginBottom:20}}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 0, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
            {t("noSignups").split("\n").map((line, i) => <span key={i}>{i > 0 && <br/>}{line}</span>)}
          </h1>
        </div>

        {/* ── Buttons ── */}
        <div style={{animation:"ob-rise 0.6s ease-out 0.16s both"}}>
          <button onClick={() => setPage("import")} style={{
            width: "100%", padding: "14px 24px", borderRadius: 14, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
            fontSize: 15, fontWeight: 800, color: C.bg, marginBottom: 10,
            boxShadow: `0 8px 28px rgba(247,147,26,0.25)`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>
            {t("importWalletBtn")}
          </button>

          <button onClick={() => setPage("create")} style={{
            width: "100%", padding: "13px 24px", borderRadius: 14, cursor: "pointer",
            background: "transparent", border: `1px solid rgba(255,255,255,0.18)`,
            fontSize: 14, fontWeight: 600, color: C.orange,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t("createNewWalletBtn")}
          </button>

          {wallets.length > 0 && !isMobileDevice() && (
            <button onClick={() => setPage("wallet")} style={{
              width: "100%", padding: "10px", borderRadius: 12, cursor: "pointer",
              background: "transparent", border: "none", marginTop: 4,
              fontSize: 13, fontWeight: 600, color: "#737373",
            }}>{"\u2190"} {t("backToMyWallet")}</button>
          )}
        </div>

      </div>

      {/* ── Bottom section — pinned to bottom ── */}
      <div style={{flexShrink:0,paddingBottom:32,textAlign:"center",animation:"ob-rise 0.6s ease-out 0.34s both"}}>
        <div style={{display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap",marginBottom:12}}>
          {[
            {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,l:t("selfCustody")},
            {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,l:t("secure")},
            {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="4" x2="17" y2="10"/><line x1="17" y1="4" x2="23" y2="10"/></svg>,l:t("noKYC")},
          ].map((item,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
            {item.icon}<span style={{fontSize:11,color:"#A3A3A3",fontWeight:600}}>{item.l}</span>
          </div>)}
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          <span style={{fontSize:11,color:"#737373",fontWeight:500}}>{t("keysNeverLeave")}</span>
        </div>
      </div>

      <style>{`
        @keyframes ob-glow { 0%,100% { opacity:0.8; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.05); } }
        @keyframes ob-rise { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
