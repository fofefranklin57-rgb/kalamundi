package com.kalamundi.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private static final String APP_URL = "https://kalamundi.afrisaas.com/";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );

        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webview);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setUserAgentString(
            settings.getUserAgentString() + " KalamundiAndroid/1.0"
        );

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (estDomaineAutorise(url)) return false;
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                View splash = findViewById(R.id.splash);
                if (splash != null) splash.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, int errorCode,
                                        String description, String failingUrl) {
                afficherOffline();
            }
        });

        if (estConnecte()) {
            webView.loadUrl(APP_URL);
        } else {
            afficherOffline();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private boolean estDomaineAutorise(String url) {
        return url.contains("kalamundi.afrisaas.com")
            || url.contains("kalamundi.pages.dev")
            || url.contains("iobieffnaauecyukecds.supabase.co")
            || url.contains("live.fapshi.com")
            || url.contains("fapshi.com");
    }

    private boolean estConnecte() {
        ConnectivityManager cm =
            (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        NetworkInfo net = cm.getActiveNetworkInfo();
        return net != null && net.isConnected();
    }

    private void afficherOffline() {
        webView.setVisibility(View.GONE);
        View offline = findViewById(R.id.offline);
        if (offline != null) offline.setVisibility(View.VISIBLE);
        View splash  = findViewById(R.id.splash);
        if (splash != null) splash.setVisibility(View.GONE);
    }

    public void reessayer(View v) {
        View offline = findViewById(R.id.offline);
        View splash  = findViewById(R.id.splash);
        if (offline != null) offline.setVisibility(View.GONE);
        if (splash  != null) splash.setVisibility(View.VISIBLE);
        webView.setVisibility(View.VISIBLE);
        if (estConnecte()) {
            webView.loadUrl(APP_URL);
        } else {
            afficherOffline();
        }
    }
}
