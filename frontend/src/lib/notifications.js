// ══════════════════════════════════════════════════════════════
// notifications.js — Browser push notifications for incoming BTC
// ══════════════════════════════════════════════════════════════

let pollTimer = null;
let lastKnownBalance = null;

// Request notification permission
export async function requestPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

// Check if notifications are supported
export function isSupported() {
  return "Notification" in window;
}

// Get current permission state
export function getPermission() {
  if (!isSupported()) return "unsupported";
  return Notification.permission;
}

// Show a notification
export function showNotification(title, body, icon) {
  if (Notification.permission !== "granted") return;
  try {
    // Try service worker notification first (works when tab is in background)
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: icon || "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          vibrate: [200, 100, 200],
        });
      });
    } else {
      // Fallback to regular notification
      new Notification(title, { body, icon: icon || "/icons/icon-192.png" });
    }
  } catch {}
}

// Get notification settings from localStorage
export function getNotifySettings() {
  try {
    return JSON.parse(localStorage.getItem("btc_notify_settings") || "{}");
  } catch {
    return {};
  }
}

// Save notification settings
export function setNotifySettings(settings) {
  localStorage.setItem("btc_notify_settings", JSON.stringify(settings));
}

// Start polling for balance changes (incoming BTC detection)
export function startBalancePoll(address, intervalMs = 30000) {
  stopBalancePoll();
  lastKnownBalance = null;

  const check = async () => {
    try {
      const res = await fetch(`/api/wallet/balance/${address}`);
      if (!res.ok) return;
      const data = await res.json();
      const confirmed = data.chain_stats?.funded_txo_sum - data.chain_stats?.spent_txo_sum;
      const unconfirmed = data.mempool_stats?.funded_txo_sum - data.mempool_stats?.spent_txo_sum;
      const totalSats = confirmed + unconfirmed;

      if (lastKnownBalance !== null && totalSats > lastKnownBalance) {
        const diff = (totalSats - lastKnownBalance) / 1e8;
        const settings = getNotifySettings();
        if (settings.incoming !== false) {
          showNotification(
            "BTC Received!",
            `+${diff.toFixed(8)} BTC received to your wallet`
          );
        }
      }
      lastKnownBalance = totalSats;
    } catch {}
  };

  // Initial check to set baseline
  check();
  pollTimer = setInterval(check, intervalMs);
}

// Stop polling
export function stopBalancePoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  lastKnownBalance = null;
}

// ══════════════════════════════════════════════════════════════
// WEB PUSH — Server-side push subscriptions
// ══════════════════════════════════════════════════════════════

// Helper: convert VAPID public key from URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Subscribe browser to Web Push via backend
export async function subscribeToPush(alerts, address, currency) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const vapidRes = await fetch("/api/push/vapid-key");
    if (!vapidRes.ok) throw new Error("Failed to get VAPID key");
    const { key } = await vapidRes.json();

    // Check if already subscribed via Push API
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const subJSON = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subJSON, alerts, address, currency }),
    });

    localStorage.setItem("btc_push_sub", JSON.stringify(subJSON));
    return subJSON;
  } catch (err) {
    console.warn("[Push] Subscribe failed:", err.message);
    return null;
  }
}

// Update alert rules on the backend
export async function updatePushAlerts(alerts, address, currency) {
  const sub = JSON.parse(localStorage.getItem("btc_push_sub") || "null");
  if (!sub) return;
  try {
    await fetch("/api/push/update-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, alerts, address, currency }),
    });
  } catch (err) {
    console.warn("[Push] Update alerts failed:", err.message);
  }
}

// Check if already subscribed to push
export function isPushSubscribed() {
  return !!localStorage.getItem("btc_push_sub");
}

// Send heartbeat to track engagement (call on app open)
export async function sendHeartbeat() {
  const sub = JSON.parse(localStorage.getItem("btc_push_sub") || "null");
  if (!sub) return;
  try {
    await fetch("/api/push/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {}
}

// Unsubscribe from push
export async function unsubscribeFromPush() {
  const sub = JSON.parse(localStorage.getItem("btc_push_sub") || "null");
  if (!sub) return;
  try {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {}
  localStorage.removeItem("btc_push_sub");
}
