// ══════════════════════════════════════════════════════════════
// native-push.js — native push integration
// ══════════════════════════════════════════════════════════════
// This module handles native push notifications via the bit21
// notification service when running inside the Capacitor native shell.
// Falls back silently on web (web uses VAPID push from notifications.js).

let PushNotifications = null;
let isNative = false;

// API base URL for native app
const API = window.Capacitor?.isNativePlatform?.() ? "https://wallet.bit21.app" : "";

// Detect if running inside Capacitor native shell
export function isNativeApp() {
  try {
    return (
      window.Capacitor?.isNativePlatform?.() ||
      window.Capacitor?.getPlatform?.() === "android" ||
      window.Capacitor?.getPlatform?.() === "ios"
    );
  } catch {
    return false;
  }
}

// Screen security — block screenshots on sensitive screens (seed phrases)
export function enableScreenSecurity() {
  if (!isNativeApp()) return;
  try { window.Capacitor?.Plugins?.ScreenSecure?.enable(); } catch {}
}
export function disableScreenSecurity() {
  if (!isNativeApp()) return;
  try { window.Capacitor?.Plugins?.ScreenSecure?.disable(); } catch {}
}

// Initialize — call once on app startup
export async function initNativePush() {
  if (!isNativeApp()) return false;
  isNative = true;

  try {
    const cap = await import("@capacitor/push-notifications");
    PushNotifications = cap.PushNotifications;
  } catch (err) {
    console.warn("[NativePush] Plugin not available:", err.message);
    return false;
  }

  // Check current permission state
  const permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === "prompt") {
    const reqResult = await PushNotifications.requestPermissions();
    if (reqResult.receive !== "granted") {
      console.warn("[NativePush] Permission denied");
      return false;
    }
  } else if (permStatus.receive !== "granted") {
    console.warn("[NativePush] Permission not granted:", permStatus.receive);
    return false;
  }

  // Register with FCM
  await PushNotifications.register();

  // Listen for registration success
  PushNotifications.addListener("registration", async (token) => {
    // Token logged truncated for security
    console.log("[NativePush] FCM token registered");
    localStorage.setItem("btc_fcm_token", token.value);

    // Register token with our backend
    try {
      await fetch(`${API}/api/fcm/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.value,
          platform: window.Capacitor?.getPlatform?.() || "android",
          alerts: {
            incoming: true,
            priceUp: true,
            priceDown: true,
            priceMilestone: true,
          },
        }),
      });
      console.log("[NativePush] Token registered with backend");
    } catch (err) {
      console.warn("[NativePush] Backend registration failed:", err.message);
    }
  });

  // Listen for registration errors
  PushNotifications.addListener("registrationError", (err) => {
    console.error("[NativePush] Registration error:", err.error);
  });

  // Listen for push received while app is in foreground
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[NativePush] Received in foreground:", notification);
    // Optionally show in-app toast/banner here
    // The notification is already shown by the system if app is in background
  });

  // Listen for notification taps (user clicked the notification)
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[NativePush] Notification tapped:", action);
    const data = action.notification?.data;
    if (data?.url) {
      // Navigate within the app if needed
      window.location.hash = data.url;
    }
  });

  return true;
}

// Update alert preferences on backend
export async function updateNativeAlerts(alerts, address, currency) {
  const token = localStorage.getItem("btc_fcm_token");
  if (!token) return;
  try {
    await fetch(`${API}/api/fcm/update-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, alerts, address, currency }),
    });
  } catch (err) {
    console.warn("[NativePush] Update alerts failed:", err.message);
  }
}

// Update FCM token with new address (after address type switch)
export async function updateFCMAddress(newAddress) {
  const token = localStorage.getItem("btc_fcm_token");
  if (!token || !newAddress) return;
  try {
    await fetch(`${API}/api/fcm/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: window.Capacitor?.getPlatform?.() || "android", address: newAddress }),
    });
  } catch (err) {
    console.warn("[NativePush] FCM address update failed:", err.message);
  }
}

// Send heartbeat for engagement tracking
export async function sendNativeHeartbeat() {
  const token = localStorage.getItem("btc_fcm_token");
  if (!token) return;
  try {
    await fetch(`${API}/api/fcm/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {}
}

// Unregister from push
export async function unregisterNativePush() {
  const token = localStorage.getItem("btc_fcm_token");
  if (!token) return;
  try {
    await fetch(`${API}/api/fcm/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {}
  localStorage.removeItem("btc_fcm_token");
  if (PushNotifications) {
    try {
      await PushNotifications.removeAllListeners();
    } catch {}
  }
}

// Check if native push is registered
export function isNativePushRegistered() {
  return !!localStorage.getItem("btc_fcm_token");
}

// Get the FCM token
export function getFCMToken() {
  return localStorage.getItem("btc_fcm_token");
}
