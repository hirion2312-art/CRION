package com.hirion.crion

// 설정 · 작품 목록 · 화면 엔진 고르기/업데이트 (컴퓨터판 src/main.js · src/updater.js 와 같은 규칙)

import android.content.Context
import android.os.Build
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest

// 화면 엔진 한 벌: 앱에 든 것(assets/engine) 또는 받은 것(files/engines/<버전>)
class Engine(val version: String, val apiLevel: Int, val minShell: String, val source: String, private val ctx: Context, val dir: File?) {
    fun open(path: String): InputStream? = try {
        if (dir != null) { val f = File(dir, path); if (f.canonicalPath.startsWith(dir.canonicalPath) && f.isFile) FileInputStream(f) else null }
        else ctx.assets.open("engine/$path")
    } catch (e: Exception) { null }
    fun read(path: String): String? = open(path)?.bufferedReader()?.use { it.readText() }
    fun bytes(path: String): ByteArray? = open(path)?.use { it.readBytes() }
}

class EnginePathHandler(private val ctx: Context, private val engine: Engine) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val p = path.trimStart('/').ifEmpty { "index.html" }
        if (p.contains("..")) return null
        val s = engine.open(p) ?: return WebResourceResponse("text/plain", "utf-8", 404, "Not Found", mapOf(), "".byteInputStream())
        val r = WebResourceResponse(mime(p), if (isText(p)) "utf-8" else null, s)
        r.responseHeaders = mapOf("Cache-Control" to "no-cache")
        return r
    }
    private fun isText(p: String) = Regex("\\.(html|js|css|json|svg|txt|md)$").containsMatchIn(p)
    private fun mime(p: String): String = when (p.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"; "js" -> "application/javascript"; "css" -> "text/css"; "json" -> "application/json"
        "png" -> "image/png"; "webp" -> "image/webp"; "jpg", "jpeg" -> "image/jpeg"; "svg" -> "image/svg+xml"
        "mp3" -> "audio/mpeg"; "woff2" -> "font/woff2"; "gif" -> "image/gif"
        else -> "application/octet-stream"
    }
}

class Shell(private val ctx: Context) {
    companion object {
        const val ENGINE_HOST = "appassets.androidplatform.net"
        const val API_LEVEL = 3   // 껍데기가 화면 엔진에 열어 주는 기능 묶음 (컴퓨터판과 같게)
        const val CRACK_ORIGIN = "https://crack.wrtn.ai"
        fun cmpVer(a: String?, b: String?): Int {
            val x = (a ?: "0").split(".").map { it.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }
            val y = (b ?: "0").split(".").map { it.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }
            for (i in 0 until 3) { val d = x.getOrElse(i) { 0 } - y.getOrElse(i) { 0 }; if (d != 0) return if (d > 0) 1 else -1 }
            return 0
        }
        fun normUrl(u: String): String = try { val x = URI(u); (x.scheme + "://" + x.host + (x.path ?: "")).trimEnd('/') } catch (e: Exception) { u }
        fun sameUrl(a: String, b: String) = a.isNotEmpty() && normUrl(a) == normUrl(b)
        fun sha256(b: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(b).joinToString("") { "%02x".format(it) }
    }

    private val prefs = ctx.getSharedPreferences("crion", Context.MODE_PRIVATE)
    private val appConfig: JSONObject = readAssetJson("config/app.json") ?: JSONObject()
    private val userEngines = File(ctx.filesDir, "engines").apply { mkdirs() }
    val appVersion: String = try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "0.0.0" } catch (e: Exception) { "0.0.0" }

    private fun readAssetJson(p: String): JSONObject? = try { JSONObject(ctx.assets.open(p).bufferedReader().readText()) } catch (e: Exception) { null }

    // ---------- 설정 (컴퓨터판 DEFAULT_SETTINGS 와 같은 칸) ----------
    private fun defaults() = JSONObject()
        .put("onboarded", false).put("volume", 60).put("textSpeed", "normal").put("choiceSend", true).put("autoUpdate", true)
        .put("workUrls", JSONObject()).put("recent", JSONArray()).put("registryUrl", "").put("engineBad", JSONArray())
    fun loadSettings(): JSONObject {
        val s = defaults()
        try { val saved = JSONObject(prefs.getString("settings", "{}") ?: "{}"); saved.keys().forEach { s.put(it, saved.get(it)) } } catch (e: Exception) { /* 처음 */ }
        return s
    }
    private fun saveSettings(s: JSONObject): JSONObject { prefs.edit().putString("settings", s.toString()).apply(); return s }
    fun patchSettings(patch: JSONObject): JSONObject {
        val s = loadSettings(); val d = defaults()
        patch.keys().forEach { k -> if (d.has(k) && k != "engineBad") s.put(k, patch.get(k)) }
        return saveSettings(s)
    }
    fun markBad(version: String) { val s = loadSettings(); s.getJSONArray("engineBad").put(version); saveSettings(s) }

    fun registryUrl(): String = loadSettings().optString("registryUrl").ifEmpty { appConfig.optString("registryUrl") }
    private fun registryBase(): String { val u = registryUrl(); return if (u.isEmpty()) "" else u.substring(0, u.lastIndexOf('/') + 1) }

    fun info(engine: Engine): JSONObject = JSONObject()
        .put("version", appVersion).put("engineVersion", engine.version).put("engineSource", engine.source).put("apiLevel", API_LEVEL)
        .put("crackOrigin", CRACK_ORIGIN).put("platform", "android").put("registryUrl", registryUrl()).put("updatesEnabled", registryUrl().isNotEmpty())
        .put("links", appConfig.optJSONObject("links") ?: JSONObject()).put("device", Build.MODEL ?: "")

    // ---------- 화면 엔진 고르기 ----------
    private fun readEngine(dir: File?, source: String): Engine? {
        val txt = try { if (dir != null) File(dir, "engine.json").readText() else ctx.assets.open("engine/engine.json").bufferedReader().readText() } catch (e: Exception) { return null }
        val m = try { JSONObject(txt) } catch (e: Exception) { return null }
        val e = Engine(m.optString("version", ""), m.optInt("apiLevel", 1), m.optString("minShell", "0.0.0"), source, ctx, dir)
        if (e.version.isEmpty() || e.open("index.html") == null) return null
        return e
    }
    fun pickEngine(): Engine {
        val bad = loadSettings().optJSONArray("engineBad")?.let { a -> (0 until a.length()).map { a.optString(it) }.toSet() } ?: emptySet()
        var best = readEngine(null, "bundled")!!
        userEngines.listFiles()?.forEach { d ->
            if (!d.isDirectory || d.name.contains(".tmp-")) return@forEach
            val e = readEngine(d, "update") ?: return@forEach
            if (e.version in bad || e.apiLevel != API_LEVEL || cmpVer(appVersion, e.minShell) < 0) return@forEach
            if (cmpVer(e.version, best.version) > 0) best = e
        }
        return best
    }

    // ---------- 네트워크 ----------
    private fun get(url: String): ByteArray {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15000; c.readTimeout = 30000; c.useCaches = false
        c.setRequestProperty("Cache-Control", "no-cache")
        try {
            if (c.responseCode !in 200..299) throw RuntimeException("HTTP ${c.responseCode}")
            return c.inputStream.use { it.readBytes() }
        } finally { c.disconnect() }
    }
    private fun bust(u: String) = u + (if (u.contains("?")) "&" else "?") + "t=" + System.currentTimeMillis()

    // ---------- 작품 목록: 앱에 든 config/works.json + 업데이트 서버 catalog.json ----------
    fun mergeWorks(): JSONObject {
        val bundled = readAssetJson("config/works.json") ?: JSONObject().put("works", JSONArray())
        var remote: JSONObject? = null
        val base = registryBase()
        if (base.isNotEmpty()) {
            try { val b = get(bust(base + "catalog.json")); remote = JSONObject(String(b, Charsets.UTF_8)); prefs.edit().putString("catalog", remote.toString()).apply() }
            catch (e: Exception) { remote = try { JSONObject(prefs.getString("catalog", "") ?: "") } catch (x: Exception) { null } }
        }
        val useRemote = remote != null && (remote.optJSONArray("works")?.length() ?: 0) > 0
        val src = if (useRemote) remote!! else bundled
        val hidden = mutableSetOf<String>()
        listOf(bundled.optJSONArray("hidden"), remote?.optJSONArray("hidden")).forEach { a -> if (a != null) for (i in 0 until a.length()) hidden.add(normUrl(a.optString(i))) }
        val list = JSONArray()
        val ws = src.optJSONArray("works") ?: JSONArray()
        for (i in 0 until ws.length()) {
            val w = ws.optJSONObject(i) ?: continue
            if (w.optString("url").isNotEmpty() && normUrl(w.optString("url")) in hidden) continue
            // 앱에 든 목록의 썸네일 이름은 업데이트 서버 주소로
            if (!useRemote && w.optString("thumb").isNotEmpty() && !w.optString("thumb").startsWith("http") && base.isNotEmpty())
                w.put("thumb", base + "thumbs/" + URLEncoder.encode(w.optString("thumb").substringAfterLast('/'), "UTF-8").replace("+", "%20"))
            list.put(w)
        }
        return JSONObject().put("works", list).put("syncedAt", JSONObject.NULL)
            .put("creatorUrl", remote?.optString("creatorUrl")?.ifEmpty { null } ?: bundled.optString("creatorUrl").ifEmpty { appConfig.optString("creatorUrl") })
    }

    // ---------- 화면 엔진 업데이트 (컴퓨터판 checkUpdates 와 같은 규칙) ----------
    @Volatile private var checking = false
    fun checkUpdates(running: Engine, manual: Boolean, emit: (JSONObject) -> Unit): JSONObject {
        val result = JSONObject().put("skipped", JSONObject.NULL).put("engine", JSONObject.NULL).put("error", JSONObject.NULL)
        if (checking) return result.put("skipped", "busy")
        val url = registryUrl()
        if (!url.startsWith("https://")) return result.put("skipped", "no-registry")
        checking = true
        try {
            val bytes = get(bust(url))
            val pub = appConfig.optString("pubkey")
            if (pub.isNotEmpty()) {
                // 서명 확인 (Ed25519). 안드로이드 13 미만은 확인할 수 없어 업데이트를 받지 않는다
                val sig = String(get(bust("$url.sig"))).trim()
                if (!Sig.verify(bytes, sig, pub)) throw RuntimeException("목록 서명이 맞지 않아요")
            }
            val idx = JSONObject(String(bytes, Charsets.UTF_8))
            val e = idx.optJSONObject("engine")
            val s = loadSettings()
            val bad = s.optJSONArray("engineBad")?.toString() ?: "[]"
            val auto = s.optBoolean("autoUpdate", true) || manual
            if (e != null && Regex("^\\d+\\.\\d+\\.\\d+$").matches(e.optString("version")) && cmpVer(e.optString("version"), running.version) > 0 && !bad.contains("\"" + e.optString("version") + "\"")) {
                val v = e.optString("version")
                if (cmpVer(appVersion, e.optString("minShell", "0")) < 0 || e.optInt("apiLevel", API_LEVEL) != API_LEVEL) {
                    result.put("engine", JSONObject().put("state", "shell-old").put("version", v))
                    emit(JSONObject().put("type", "shell-old").put("version", v).put("url", appConfig.optString("downloadUrl")))
                } else if (auto) {
                    val dest = File(userEngines, v)
                    if (!File(dest, "engine.json").exists()) syncDir(e, dest, running)
                    prune(2)
                    result.put("engine", JSONObject().put("state", "ready").put("version", v))
                    emit(JSONObject().put("type", "engine-ready").put("version", v))
                }
            }
        } catch (ex: Exception) {
            result.put("error", ex.message ?: ex.toString())
            if (manual) emit(JSONObject().put("type", "error").put("message", ex.message ?: ""))
        } finally { checking = false }
        return result
    }
    private fun syncDir(entry: JSONObject, dest: File, running: Engine) {
        val base = entry.getString("base")
        val files = entry.getJSONArray("files")
        val tmp = File(dest.parentFile, dest.name + ".tmp-" + System.currentTimeMillis())
        tmp.mkdirs()
        try {
            for (i in 0 until files.length()) {
                val f = files.getJSONObject(i)
                val rel = f.getString("path")
                if (rel.contains("..") || rel.startsWith("/") || Regex("^[a-z]+:", RegexOption.IGNORE_CASE).containsMatchIn(rel)) throw RuntimeException("이상한 경로: $rel")
                val want = f.getString("sha256")
                // 지금 엔진에 같은 파일이 있으면 그대로 쓴다
                var b = running.bytes(rel)?.takeIf { sha256(it) == want }
                if (b == null) {
                    val u = URL(URL(base), rel.split("/").joinToString("/") { URLEncoder.encode(it, "UTF-8").replace("+", "%20") }).toString()
                    b = get(bust(u))
                    if (sha256(b) != want) throw RuntimeException("파일이 손상됐어요: $rel")
                }
                val out = File(tmp, rel)
                out.parentFile?.mkdirs()
                out.writeBytes(b)
            }
            if (dest.exists()) dest.deleteRecursively()
            if (!tmp.renameTo(dest)) throw RuntimeException("저장 실패")
        } finally { if (tmp.exists()) tmp.deleteRecursively() }
    }
    private fun prune(keep: Int) {
        val dirs = userEngines.listFiles()?.filter { it.isDirectory } ?: return
        dirs.filter { it.name.contains(".tmp-") }.forEach { it.deleteRecursively() }
        dirs.filter { !it.name.contains(".tmp-") }.sortedWith { a, b -> cmpVer(b.name, a.name) }.drop(keep).forEach { it.deleteRecursively() }
    }
}
