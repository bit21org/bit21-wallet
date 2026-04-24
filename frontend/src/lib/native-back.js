// ══════════════════════════════════════════════════════════════
// native-back.js — Android hardware back button for Capacitor
// ══════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";

// Check if running in native app
function isNative() {
  try {
    return window.Capacitor?.isNativePlatform?.() || false;
  } catch {
    return false;
  }
}

/**
 * useNativeBack — hooks into Android back button via Capacitor App plugin.
 * Calls the provided `onBack` callback when hardware back is pressed.
 * The callback should return `true` if it handled navigation (go back in app),
 * or `false` if the app should minimize/exit.
 */
export function useNativeBack(onBack) {
  const callbackRef = useRef(onBack);
  callbackRef.current = onBack;

  useEffect(() => {
    if (!isNative()) return;

    let cleanup = null;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", ({ canGoBack }) => {
          callbackRef.current?.();
          // Never minimize or exit — do nothing if not handled
        });
        cleanup = () => listener.remove();
      } catch (err) {
        console.warn("[NativeBack] Plugin not available:", err.message);
      }
    })();

    return () => {
      cleanup?.();
    };
  }, []);
}
