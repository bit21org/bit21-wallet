# Bit21 Wallet - ProGuard Rules (Anti-Reverse-Engineering)

# Keep Capacitor classes (required for WebView bridge)
-keep class com.getcapacitor.** { *; }
-keep class com.bit21.wallet.** { *; }

# Keep JavaScript interface for WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}

# Obfuscation settings
-repackageclasses ''
-allowaccessmodification
-overloadaggressively

# Remove source file names and line numbers (anti-debugging)
-renamesourcefileattribute ''
-keepattributes !SourceFile,!LineNumberTable

# Optimize
-optimizationpasses 5
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*
