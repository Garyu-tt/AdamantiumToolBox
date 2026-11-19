package com.adamantium.aicore;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import android.graphics.Color;
import android.view.ViewGroup;
import android.widget.TextView;

public final class ChatActivity extends Activity {
    private WebView browser;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String url;
        try { url = Settings.httpsChat(getIntent().getStringExtra("url")); }
        catch (Exception e) { TextView t = new TextView(this); t.setText("Invalid chat URL"); setContentView(t); return; }

        browser = new WebView(this);
        browser.setBackgroundColor(Color.WHITE);
        browser.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true); // needed by the configured modern chat UI
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"https".equalsIgnoreCase(request.getUrl().getScheme());
            }
        });
        setContentView(browser);
        browser.loadUrl(url);
    }

    @Override public void onBackPressed() {
        if (browser != null && browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (browser != null) { browser.stopLoading(); browser.destroy(); browser = null; }
        super.onDestroy();
    }
}
