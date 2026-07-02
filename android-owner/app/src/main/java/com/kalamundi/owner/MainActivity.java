package com.kalamundi.owner;

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
import android.widget.TextView;

public class MainActivity extends Activity {

    // ⚠️ REMPLACE ICI avec ton vrai domaine Cloudflare Pages
    private static final String OWNER_URL = "https://kalamundi.pages.dev/pages/owner.html";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Plein écran immersif
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);

        // ── Paramètres WebView ──────────────────────────────────
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);       // localStorage pour Supabase session
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setUserAgentString(
            settings.getUserAgentString() + " KalamundiOwner/1.0"
        );

        // Cookies persistants (session Supabase)
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // ── Client WebView — navigation interne uniquement ──────
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Garder la navigation dans la WebView pour le même domaine
                if (url.contains("kalamundi.pages.dev") || url.contains("supabase.co")) {
                    return false;
                }
                // Liens externes → ignorer (pas de navigateur externe depuis le dashboard owner)
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Masquer l'écran de chargement une fois la page prête
                View splash = findViewById(R.id.splash);
                if (splash != null) splash.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, int errorCode,
                                        String description, String failingUrl) {
                // Pas de réseau — afficher écran offline
                afficherOffline();
            }
        });

        // ── Chargement ──────────────────────────────────────────
        if (estConnecte()) {
            webView.loadUrl(OWNER_URL);
        } else {
            afficherOffline();
        }
    }

    // ── Bouton retour — naviguer dans WebView ──────────────────
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // ── Réseau ─────────────────────────────────────────────────
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

    // Réessayer depuis l'écran offline
    public void reessayer(View v) {
        View offline = findViewById(R.id.offline);
        View splash  = findViewById(R.id.splash);
        if (offline != null) offline.setVisibility(View.GONE);
        if (splash  != null) splash.setVisibility(View.VISIBLE);
        webView.setVisibility(View.VISIBLE);
        if (estConnecte()) {
            webView.reload();
        } else {
            afficherOffline();
        }
    }
}
