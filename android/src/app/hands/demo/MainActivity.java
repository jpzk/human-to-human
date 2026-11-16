package app.hands.demo;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// A thin WebView shell around the hands web app. The site URL comes from
// res/values/strings.xml (app_url), written by build.sh.
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.parseColor("#F7F7F4"));
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F7F7F4"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        final String home = Uri.parse(getString(R.string.app_url)).getHost();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (home != null && home.equals(u.getHost())) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, u)); // GitHub etc. open in the browser
                return true;
            }
        });

        Uri link = getIntent().getData();
        web.loadUrl(link != null ? link.toString() : getString(R.string.app_url));
        setContentView(web);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
