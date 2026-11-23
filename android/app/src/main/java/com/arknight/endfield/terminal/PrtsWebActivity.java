package com.arknight.endfield.terminal;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class PrtsWebActivity extends AppCompatActivity {
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    private static final String PRTS_HOME = "https://prts.wiki";

    private WebView webView;
    private ProgressBar progressBar;
    private TextView titleView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        String initialUrl = getIntent().getStringExtra(EXTRA_URL);
        if (initialUrl == null || initialUrl.trim().isEmpty()) {
            initialUrl = PRTS_HOME;
        }
        String initialTitle = getIntent().getStringExtra(EXTRA_TITLE);
        if (initialTitle == null || initialTitle.trim().isEmpty()) {
            initialTitle = "PRTS.WIKI";
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0A0C0F"));

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        // Top tactical toolbar
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setBackgroundColor(Color.parseColor("#0A0C0F"));
        int padH = dp(8);
        int padV = dp(6);
        toolbar.setPadding(padH, padV, padH, padV);

        Button btnBack = createBarButton("←", "#B4C0D0");
        Button btnForward = createBarButton("→", "#B4C0D0");
        Button btnReload = createBarButton("↻", "#22BBFF");
        Button btnHome = createBarButton("PRTS", "#22BBFF");
        Button btnClose = createBarButton("✕", "#FF6A2B");

        titleView = new TextView(this);
        titleView.setText(initialTitle);
        titleView.setTextColor(Color.parseColor("#ECF0F5"));
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleView.setSingleLine(true);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        titleView.setPadding(dp(8), 0, dp(8), 0);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        );
        titleView.setLayoutParams(titleParams);

        toolbar.addView(btnBack);
        toolbar.addView(btnForward);
        toolbar.addView(titleView);
        toolbar.addView(btnReload);
        toolbar.addView(btnHome);
        toolbar.addView(btnClose);

        // Divider
        View divider = new View(this);
        divider.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(1)
        ));
        divider.setBackgroundColor(Color.parseColor("#293240"));

        // Progress bar
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(3)
        ));
        progressBar.setMax(100);
        progressBar.getProgressDrawable().setColorFilter(
            Color.parseColor("#22BBFF"),
            android.graphics.PorterDuff.Mode.SRC_IN
        );
        progressBar.setVisibility(View.GONE);

        // WebView
        webView = new WebView(this);
        webView.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        ));
        webView.setBackgroundColor(Color.parseColor("#0A0C0F"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme =
                    request != null && request.getUrl() != null
                        ? request.getUrl().getScheme()
                        : null;
                // Keep all http/https navigation inside the in-app WebView
                return !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                if (title != null && !title.trim().isEmpty()) {
                    titleView.setText(title);
                }
            }
        });

        btnBack.setOnClickListener(v -> {
            if (webView.canGoBack()) webView.goBack();
        });
        btnForward.setOnClickListener(v -> {
            if (webView.canGoForward()) webView.goForward();
        });
        btnReload.setOnClickListener(v -> webView.reload());
        btnHome.setOnClickListener(v -> webView.loadUrl(PRTS_HOME));
        btnClose.setOnClickListener(v -> finish());

        root.addView(toolbar);
        root.addView(divider);
        root.addView(progressBar);
        root.addView(webView);

        setContentView(root);
        webView.loadUrl(initialUrl);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    private Button createBarButton(String label, String hexColor) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setTextColor(Color.parseColor(hexColor));
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        btn.setAllCaps(false);
        btn.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        btn.setBackgroundColor(Color.parseColor("#13171D"));
        btn.setMinWidth(0);
        btn.setMinimumWidth(0);
        btn.setMinHeight(0);
        btn.setMinimumHeight(0);
        btn.setPadding(dp(10), dp(6), dp(10), dp(6));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        lp.setMargins(dp(2), 0, dp(2), 0);
        btn.setLayoutParams(lp);
        return btn;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
