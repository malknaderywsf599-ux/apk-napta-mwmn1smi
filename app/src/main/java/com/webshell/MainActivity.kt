package com.webshell

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
    private var chooser: ValueCallback<Array<Uri>>? = null
    private val pick = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        chooser?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data))
        chooser = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        val wv = WebView(this)
        setContentView(wv)
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest) =
                loader.shouldInterceptRequest(r.url)
        }
        wv.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                chooser?.onReceiveValue(null)
                chooser = cb
                return try { pick.launch(p.createIntent()); true } catch (e: Exception) { chooser = null; false }
            }
        }
        wv.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val wv = findViewById<android.view.ViewGroup>(android.R.id.content).getChildAt(0) as WebView
        if (wv.canGoBack()) wv.goBack() else super.onBackPressed()
    }
}
