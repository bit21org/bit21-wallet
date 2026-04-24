package com.bit21.wallet;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom plugins
        registerPlugin(ScreenSecurePlugin.class);

        // Install Android 12+ splash screen — no delay, hides as soon as ready
        SplashScreen.installSplashScreen(this);

        super.onCreate(savedInstanceState);

        // Hardware acceleration for smoother WebView rendering
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );

        // Ensure WebView does not render behind system navigation bar
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, insets) -> {
                int topInset = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
                int bottomInset = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
                v.setPadding(0, topInset, 0, bottomInset);
                return insets;
            });
        }
    }
}
