package com.arknight.endfield.terminal;

import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrtsBrowser")
public class PrtsBrowserPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "https://prts.wiki");
        String title = call.getString("title", "PRTS.WIKI");
        AppCompatActivity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        activity.runOnUiThread(() -> {
            Intent intent = new Intent(activity, PrtsWebActivity.class);
            intent.putExtra(PrtsWebActivity.EXTRA_URL, url);
            intent.putExtra(PrtsWebActivity.EXTRA_TITLE, title);
            activity.startActivity(intent);
            call.resolve();
        });
    }

    @PluginMethod
    public void setSystemChrome(PluginCall call) {
        String bgHex = call.getString("backgroundColor", "#0A0C0F");
        boolean lightIcons = Boolean.TRUE.equals(call.getBoolean("lightIcons", true));
        AppCompatActivity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                int color = Color.parseColor(bgHex);
                View content = activity.findViewById(android.R.id.content);
                if (content != null) {
                    content.setBackgroundColor(color);
                }
                Window window = activity.getWindow();
                if (window != null) {
                    WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(window, window.getDecorView());
                    if (controller != null) {
                        controller.setAppearanceLightStatusBars(!lightIcons);
                        controller.setAppearanceLightNavigationBars(!lightIcons);
                    }
                }
            } catch (Exception ignored) {
            }
            call.resolve();
        });
    }
}
