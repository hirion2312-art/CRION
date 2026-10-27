package com.hirion.crion

// CRION 안드로이드 껍데기 (컴퓨터판 src/main.js 에 해당)
//  - 화면 엔진 WebView: 컴퓨터판과 같은 src/renderer 를 https://appassets.androidplatform.net/engine/ 로 띄운다
//    (앱에 든 것 또는 업데이트로 받은 것 중 새 버전). window.crion 은 assets/host/android-host.js 가 만든다
//  - 크랙 WebView: 엔진의 <webview id="crack"> 자리에 겹쳐 띄운다. 크랙 화면 도우미(crack-preload.js)를 문서 시작 때 넣는다
//  - 보내기·읽기 규칙은 컴퓨터판과 같다: 플레이어가 누른 한 번 = 전송 한 번 (도우미가 지킨다)

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var root: FrameLayout
    private lateinit var engineWv: WebView
    private lateinit var crackWv: WebView
    private lateinit var shell: Shell
    private lateinit var engine: Engine
    private var hostProxy: JavaScriptReplyProxy? = null
    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newFixedThreadPool(3)
    private var readyTimer: Runnable? = null
    private var crackLoaded = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        shell = Shell(this)
        engine = shell.pickEngine()

        root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#F6F7F9"))
        setContentView(root)

        // ---------- 크랙 WebView (아래) ----------
        crackWv = WebView(this)
        crackWv.outlineProvider = null
        crackWv.visibility = View.INVISIBLE
        CookieManager.getInstance().setAcceptThirdPartyCookies(crackWv, true)
        crackWv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = true
        }
        root.addView(crackWv, FrameLayout.LayoutParams(1, 1))

        // ---------- 화면 엔진 WebView (위) ----------
        engineWv = WebView(this)
        engineWv.outlineProvider = null
        engineWv.setBackgroundColor(Color.parseColor("#F6F7F9"))
        engineWv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
        }
        root.addView(engineWv, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setCrackOver(false)

        setupCrack()
        setupEngine()
        // 시작 3초 뒤 한 번, 이후 30분마다 업데이트 확인 (컴퓨터판과 같음)
        main.postDelayed({ checkUpdatesAsync(false) }, 3000)
        main.postDelayed(object : Runnable { override fun run() { checkUpdatesAsync(false); main.postDelayed(this, 30 * 60 * 1000L) } }, 30 * 60 * 1000L)
    }

    // ---------- 화면 엔진 ----------
    @SuppressLint("RequiresFeature")
    private fun setupEngine() {
        val loader = WebViewAssetLoader.Builder()
            .setDomain(Shell.ENGINE_HOST)
            .addPathHandler("/engine/", EnginePathHandler(this, engine))
            .build()
        val hostJs = assets.open("host/android-host.js").bufferedReader().readText()
        val docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        engineWv.webViewClient = object : WebViewClient() {
            // 문서 시작 때 넣기를 못 하는 오래된 WebView: 페이지가 시작될 때 넣는다
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) { if (!docStart) view.evaluateJavascript(hostJs, null) }
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(request.url)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == Shell.ENGINE_HOST) return false
                openExternal(u.toString())   // 엔진 화면은 다른 곳으로 이동하지 않는다 (컴퓨터판 will-navigate 막기)
                return true
            }
        }
        engineWv.webChromeClient = WebChromeClient()
        val origins = setOf("https://" + Shell.ENGINE_HOST)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(engineWv, "CrionHost", origins) { _, message, _, isMainFrame, proxy ->
                if (!isMainFrame) return@addWebMessageListener
                hostProxy = proxy
                onHostMessage(message.data ?: "")
            }
        }
        if (docStart) WebViewCompat.addDocumentStartJavaScript(engineWv, hostJs, origins)
        engineWv.loadUrl("https://" + Shell.ENGINE_HOST + "/engine/index.html")
        // 받아 온 엔진이 25초 안에 화면을 못 띄우면 그 버전을 막고 앱에 든 엔진으로 되돌린다 (컴퓨터판과 같음)
        if (engine.source == "update") {
            val r = Runnable { shell.markBad(engine.version); recreate() }
            readyTimer = r
            main.postDelayed(r, 25000)
        }
    }

    private fun onHostMessage(raw: String) {
        val m = try { JSONObject(raw) } catch (e: Exception) { return }
        val id = m.optInt("id", 0)
        val op = m.optString("op")
        val arg = m.opt("arg")
        fun reply(result: Any?) { if (id > 0) sendHost(JSONObject().put("id", id).put("result", result ?: JSONObject.NULL)) }
        fun fail(msg: String) { if (id > 0) sendHost(JSONObject().put("id", id).put("error", msg)) }
        when (op) {
            "host:hello" -> {}
            "app:info" -> reply(shell.info(engine))
            "engine:ready" -> { readyTimer?.let { main.removeCallbacks(it) }; readyTimer = null; reply(true) }
            "settings:get" -> reply(shell.loadSettings())
            "settings:set" -> reply(shell.patchSettings(arg as? JSONObject ?: JSONObject()))
            "works:get" -> io.execute { val r = shell.mergeWorks(); main.post { reply(r) } }
            "updates:check" -> io.execute { val r = shell.checkUpdates(engine, true) { ev -> main.post { emit(ev) } }; main.post { reply(r) } }
            "app:relaunch" -> { reply(true); main.postDelayed({ recreate() }, 100) }
            "app:finish" -> finish()
            "clipboard:write" -> {
                val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("CRION", (arg as? String) ?: ""))
                reply(true)
            }
            "shell:open" -> { openExternal((arg as? String) ?: ""); reply(true) }
            // ---- <webview> 흉내 ----
            "wv:rect" -> placeCrack(arg as? JSONObject)
            "wv:hide" -> { crackWv.visibility = View.INVISIBLE; setCrackOver(false) }
            "wv:load" -> {
                val o = arg as? JSONObject
                val url = o?.optString("url") ?: ""
                // 같은 주소를 다시 붙인 것(화면 다시 그리기)이면 새로 열지 않는다
                if (o?.optBoolean("first") == true && crackLoaded && Shell.sameUrl(url, crackWv.url ?: "")) {
                    emitWv("dom-ready"); emitWv("did-stop-loading")
                } else if (url.startsWith("https://")) { crackLoaded = true; crackWv.loadUrl(url) }
            }
            "wv:reload" -> crackWv.reload()
            "wv:back" -> if (crackWv.canGoBack()) crackWv.goBack()
            "wv:send" -> {
                val o = arg as? JSONObject ?: return
                val js = "window.__crionFire && window.__crionFire(" + JSONObject.quote(o.optString("ch")) + "," + (o.opt("d")?.let { if (it == JSONObject.NULL) "null" else if (it is String) JSONObject.quote(it) else it.toString() } ?: "null") + ")"
                crackWv.evaluateJavascript(js, null)
            }
            else -> fail("모르는 요청: $op")
        }
    }

    private fun sendHost(o: JSONObject) {
        val p = hostProxy ?: return
        try { p.postMessage(o.toString()) } catch (e: Exception) { /* 화면이 다시 열리는 중 */ }
    }
    private fun emit(data: JSONObject) = sendHost(JSONObject().put("ev", JSONObject().put("type", "update").put("data", data)))
    private fun emitWv(name: String, extra: JSONObject? = null) {
        val ev = extra ?: JSONObject()
        ev.put("type", "wv").put("name", name).put("canGoBack", crackWv.canGoBack())
        sendHost(JSONObject().put("ev", ev))
    }

    // ---------- 크랙 화면 자리 · 위/아래 ----------
    private fun placeCrack(o: JSONObject?) {
        o ?: return
        val dpr = o.optDouble("dpr", 1.0).takeIf { it > 0 } ?: 1.0
        val w = (o.optDouble("w") * dpr).toInt()
        val h = (o.optDouble("h") * dpr).toInt()
        if (w < 2 || h < 2) { crackWv.visibility = View.INVISIBLE; setCrackOver(false); return }
        val lp = FrameLayout.LayoutParams(w, h)
        lp.leftMargin = (o.optDouble("x") * dpr).toInt()
        lp.topMargin = (o.optDouble("y") * dpr).toInt()
        crackWv.layoutParams = lp
        crackWv.visibility = View.VISIBLE
        setCrackOver(o.optBoolean("over", true))
    }
    // 위 = 크랙 화면이 보이고 만져진다 / 아래 = 게임 화면(플레이팩)·겹창이 보인다. 크랙 화면은 아래에서도 계속 돈다
    private fun setCrackOver(over: Boolean) {
        engineWv.z = 5f
        crackWv.z = if (over) 10f else 0f
    }

    // ---------- 크랙 WebView ----------
    @SuppressLint("RequiresFeature")
    private fun setupCrack() {
        val crackOrigins = setOf("https://crack.wrtn.ai", "https://*.wrtn.ai")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(crackWv, "CrionNative", crackOrigins) { _, message, _, isMainFrame, _ ->
                if (!isMainFrame) return@addWebMessageListener
                val m = try { JSONObject(message.data ?: "") } catch (e: Exception) { return@addWebMessageListener }
                val ch = m.optString("ch")
                if (!ch.startsWith("crion:")) return@addWebMessageListener
                emitWv("ipc-message", JSONObject().put("channel", ch).put("args", JSONArray().put(m.opt("d") ?: JSONObject.NULL)))
            }
        }
        val preload = engine.read("crack-preload.js") ?: ""
        val wrapped = CRACK_SHIM_HEAD + preload + CRACK_SHIM_TAIL
        val crackDocStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (crackDocStart) WebViewCompat.addDocumentStartJavaScript(crackWv, wrapped, crackOrigins)
        crackWv.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                if (!crackDocStart && isCrackHost(url)) view.evaluateJavascript(wrapped, null)
                emitWv("did-start-loading", JSONObject().put("url", url))
            }
            override fun onPageFinished(view: WebView, url: String) {
                if (!crackDocStart && isCrackHost(url)) view.evaluateJavascript(wrapped, null)
                emitWv("dom-ready", JSONObject().put("url", url))
                emitWv("did-stop-loading", JSONObject().put("url", url))
            }
            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) { emitWv("did-navigate", JSONObject().put("url", url)) }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                emitWv("did-fail-load", JSONObject().put("errorCode", error.errorCode).put("errorDescription", error.description?.toString() ?: ""))
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = guardCrackNav(view, request.url, request.isForMainFrame)
        }
        crackWv.webChromeClient = WebChromeClient()
    }


    // ---------- 크랙 화면이 앱·플레이스토어로 넘어가는 것 막기 ----------
    //  폰에서 크랙 웹은 대화방에 들어가면 '앱으로 열기'(intent:// · market:// · 앱 링크 · play.google.com)로 보내려 한다.
    //  크랙 화면 안에서는 크랙(wrtn.ai)과 로그인 페이지만 연다. 그 밖의 이동은 막고, 앱 연결 중 카카오 로그인만 허용한다.
    private val navHosts = listOf("wrtn.ai", "accounts.google.com", "kauth.kakao.com", "accounts.kakao.com", "logins.daum.net",
        "appleid.apple.com", "nid.naver.com", "www.facebook.com", "m.facebook.com")
    private fun hostOk(h: String?) = h != null && navHosts.any { h == it || h.endsWith(".$it") }
    private val loginApps = setOf("com.kakao.talk")   // 카카오톡 간편 로그인
    private fun guardCrackNav(view: WebView, u: Uri, mainFrame: Boolean): Boolean {
        val scheme = (u.scheme ?: "").lowercase()
        if (scheme == "https") {
            if (hostOk(u.host)) return false
            if (!mainFrame) return false
            blockedNav(u.toString())
            return true   // play.google.com · 앱 링크(onelink, app.link, page.link …) · 그 밖의 사이트
        }
        if (scheme == "intent") {
            val i = try { Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) } catch (e: Exception) { null }
            if (i != null && i.`package` in loginApps) {
                try { i.addCategory(Intent.CATEGORY_BROWSABLE); i.component = null; i.selector = null; startActivity(i); return true } catch (e: Exception) { /* 앱 없음 → 대체 주소 */ }
            }
            // 대체 웹 주소가 크랙·로그인이면 그쪽으로 (앱 대신 웹으로 계속)
            val fb = i?.getStringExtra("browser_fallback_url")
            if (fb != null && fb.startsWith("https://") && hostOk(Uri.parse(fb).host)) { view.loadUrl(fb); return true }
            blockedNav(u.toString())
            return true
        }
        if (scheme == "kakaotalk" || scheme == "kakaokompassauth" || scheme == "kakaolink") {
            try { startActivity(Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE)) } catch (e: Exception) { /* 앱 없음 */ }
            return true
        }
        blockedNav(u.toString())   // market:// · wrtn:// · crack:// 등 앱·스토어 열기
        return true
    }
    private var lastBlock = 0L
    private fun blockedNav(url: String) {
        android.util.Log.i("CRION", "크랙 화면 이동 막음: $url")
        val now = System.currentTimeMillis()
        if (now - lastBlock > 4000) { lastBlock = now; emitWv("crion-blocked", JSONObject().put("url", url)) }
    }

    private fun isCrackHost(url: String): Boolean { val h = try { Uri.parse(url).host ?: "" } catch (e: Exception) { "" }; return h == "wrtn.ai" || h.endsWith(".wrtn.ai") }

    private fun openExternal(url: String) {
        if (!url.startsWith("https://")) return
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (e: Exception) { /* 브라우저 없음 */ }
    }

    private fun checkUpdatesAsync(manual: Boolean) {
        io.execute { shell.checkUpdates(engine, manual) { ev -> main.post { emit(ev) } } }
    }

    @Deprecated("뒤로 버튼")
    override fun onBackPressed() {
        // 크랙 화면이 위에 있고 뒤로 갈 곳이 있으면 크랙에서 뒤로, 아니면 화면 엔진에 알린다(겹창 닫기 → 플레이 나가기 → 앱 닫기)
        if (crackWv.visibility == View.VISIBLE && crackWv.z > engineWv.z && crackWv.canGoBack()) { crackWv.goBack(); return }
        if (hostProxy == null) { super.onBackPressed(); return }
        sendHost(JSONObject().put("ev", JSONObject().put("type", "back")))
    }

    override fun onPause() { super.onPause(); CookieManager.getInstance().flush() }
    override fun onDestroy() { io.shutdownNow(); engineWv.destroy(); crackWv.destroy(); super.onDestroy() }

    companion object {
        // 크랙 화면 도우미(컴퓨터판 crack-preload.js 그대로)를 안드로이드에서 돌리는 감싸기: require('electron').ipcRenderer 흉내
        const val CRACK_SHIM_HEAD = """(function(){
if (window.top !== window || window.__crionPre) return; window.__crionPre = 1;
var H = {};
window.__crionFire = function (ch, d) { (H[ch] || []).forEach(function (f) { try { f({}, d); } catch (e) {} }); };
var __crionIpc = {
  on: function (ch, f) { (H[ch] = H[ch] || []).push(f); },
  sendToHost: function (ch, d) { try { window.CrionNative.postMessage(JSON.stringify({ ch: ch, d: d === undefined ? null : d })); } catch (e) {} }
};
var require = function () { return { ipcRenderer: __crionIpc }; };
"""
        const val CRACK_SHIM_TAIL = "\n})();"
    }
}
