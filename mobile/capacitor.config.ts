import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bit21.wallet",
  appName: "bit21",
  webDir: "../frontend/dist",
  server: {
    // In production, the app loads from bundled files (no server needed)
    // For development, uncomment to connect to your dev server:
    // url: "http://YOUR_LOCAL_IP:5173",
    // cleartext: true,

    // Android WebView settings
    androidScheme: "https",
  },
  android: {
    // WebView debugging disabled for production
    webContentsDebuggingEnabled: false,
    // Mixed content disabled for security
    allowMixedContent: false,
    // App background color
    backgroundColor: "#08080A",
    // Disable overscroll bounce/glow
    overScrollMode: "never",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      launchFadeOutDuration: 200,
      backgroundColor: "#08080A",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#08080A",
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#F7931A",
      sound: "default",
    },
  },
};

export default config;
