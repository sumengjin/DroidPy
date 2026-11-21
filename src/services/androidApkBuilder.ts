import JSZip from 'jszip';
import { PythonFile } from '../types/ide';

export interface GitHubApkBundleOptions {
  appTitle: string;
  packageId: string;
  includeStoragePermission: boolean;
  files: PythonFile[];
  bridgeToken: string;
}

export async function generateGitHubApkProjectZip(opts: GitHubApkBundleOptions): Promise<Blob> {
  const zip = new JSZip();
  const safeTitle = opts.appTitle.trim() || 'DroidPy';
  const safePkg = opts.packageId.trim() || 'org.droidpy.app';
  const pkgPath = safePkg.replace(/\./g, '/');
  const safeToken = opts.bridgeToken.replace(/["'\\]/g, '') || 'droidpy-local';

  const appSlug = safeTitle.replace(/\s+/g, '-') || 'DroidPy';

  // 1. GitHub Actions Workflow — builds standalone ARM64 APK with embedded Termux bootstrap
  zip.file(
    '.github/workflows/build-apk.yml',
    `name: Build DroidPy Android APK

on:
  push:
    branches: [ main, master ]
    tags: [ 'v*' ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Setup Gradle 8.7
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.7'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Bundle Offline Web UI if present
        run: |
          if [ -f "package.json" ]; then
            if [ -f "package-lock.json" ]; then
              npm ci || npm install --legacy-peer-deps --no-audit --no-fund
            else
              npm install --legacy-peer-deps --no-audit --no-fund
            fi
            npm run build
            rm -rf android/app/src/main/assets/www
            mkdir -p android/app/src/main/assets/www
            cp -r dist/* android/app/src/main/assets/www/
          fi

      - name: Download Termux ARM64 Bootstrap
        run: |
          mkdir -p android/app/src/main/assets
          curl -fL "https://github.com/termux/termux-packages/releases/latest/download/bootstrap-aarch64.zip" \\
            -o android/app/src/main/assets/bootstrap-aarch64.zip

      - name: Build Debug APK (Arm64)
        working-directory: android
        run: gradle assembleDebug --no-daemon

      - name: Prepare Release APK Filename
        run: |
          mkdir -p release-apk
          TAG_NAME="\${GITHUB_REF_NAME:-dev}"
          cp android/app/build/outputs/apk/debug/*.apk "release-apk/${appSlug}-arm64-\${TAG_NAME}.apk"

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${appSlug}-arm64-apk
          path: release-apk/*.apk

      - name: Publish GitHub Release on Tag
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          body_path: CHANGELOG.md
          files: |
            release-apk/*.apk
`
  );

  // 2. Gradle root files
  zip.file(
    'android/settings.gradle.kts',
    `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${safeTitle}"
include(":app")
`
  );

  zip.file(
    'android/build.gradle.kts',
    `plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
`
  );

  zip.file(
    'android/gradle.properties',
    `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
`
  );

  zip.file(
    'android/app/build.gradle.kts',
    `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "${safePkg}"
    compileSdk = 34

    defaultConfig {
        applicationId = "${safePkg}"
        minSdk = 24
        // targetSdk = 28 讓內嵌 Termux bootstrap 能在 App 私有目錄自由執行 pkg / python / clang（GitHub 發佈專用）
        targetSdk = 28
        versionCode = 1
        versionName = "1.0.0"

        ndk {
            abiFilters += listOf("arm64-v8a")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    androidResources {
        noCompress += listOf("zip")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
`
  );

  // 3. AndroidManifest.xml with full network (crawler) & storage permissions
  const storagePerms = opts.includeStoragePermission
    ? `    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />`
    : '';

  zip.file(
    'android/app/src/main/AndroidManifest.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />
${storagePerms}

    <application
        android:allowBackup="true"
        android:label="${safeTitle}"
        android:usesCleartextTraffic="true"
        android:theme="@style/Theme.AppCompat.DayNight.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`
  );

  // 4. MainActivity.kt (hosts DroidPy WebView + starts embedded Termux Bootstrap server)
  zip.file(
    `android/app/src/main/java/${pkgPath}/MainActivity.kt`,
    `package ${safePkg}

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.File
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var rootContainer: FrameLayout
    private lateinit var crawlerOverlay: LinearLayout
    private lateinit var crawlerWebView: WebView
    private lateinit var crawlerUrlInput: EditText
    private lateinit var crawlerUaBtn: Button
    private var crawlerDesktopUa: Boolean = false
    private var localBridge: EmbeddedTermuxBridge? = null

    private val mobileUaString =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
    private val desktopUaString =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    inner class NativeDownloadBridge {
        @JavascriptInterface
        fun isNativeApp(): Boolean = true

        @JavascriptInterface
        fun openCrawlerBrowser(url: String, desktopUa: Boolean) {
            runOnUiThread {
                crawlerDesktopUa = desktopUa
                applyCrawlerUa()
                val safeUrl = if (url.startsWith("http://") || url.startsWith("https://")) url else "https://$url"
                crawlerUrlInput.setText(safeUrl)
                crawlerOverlay.visibility = View.VISIBLE
                crawlerWebView.loadUrl(safeUrl)
            }
        }

        @JavascriptInterface
        fun closeCrawlerBrowser() {
            runOnUiThread {
                crawlerOverlay.visibility = View.GONE
            }
        }

        @JavascriptInterface
        fun saveBase64File(base64Data: String, fileName: String, mimeType: String) {
            val safeName = File(fileName).name.ifBlank { "droidpy-export.bin" }
            thread {
                try {
                    val clean = base64Data.substringAfter(",")
                    val bytes = Base64.decode(clean, Base64.DEFAULT)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val values = ContentValues().apply {
                            put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                            put(MediaStore.Downloads.MIME_TYPE, mimeType)
                            put(MediaStore.Downloads.IS_PENDING, 1)
                        }
                        val resolver = contentResolver
                        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        if (uri != null) {
                            resolver.openOutputStream(uri)?.use { it.write(bytes) }
                            values.clear()
                            values.put(MediaStore.Downloads.IS_PENDING, 0)
                            resolver.update(uri, values, null, null)
                        }
                    } else {
                        @Suppress("DEPRECATION")
                        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        dir.mkdirs()
                        File(dir, safeName).writeBytes(bytes)
                    }
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "已儲存至下載資料夾: $safeName", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "儲存失敗: \${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun applyCrawlerUa() {
        crawlerWebView.settings.userAgentString = if (crawlerDesktopUa) desktopUaString else mobileUaString
        crawlerUaBtn.text = if (crawlerDesktopUa) "PC" else "Mobile"
    }

    private fun captureCrawlerCookiesAndReturn() {
        CookieManager.getInstance().flush()
        val targetUrl = crawlerWebView.url ?: crawlerUrlInput.text.toString().trim()
        val rawCookie = CookieManager.getInstance().getCookie(targetUrl) ?: ""
        val ua = crawlerWebView.settings.userAgentString ?: mobileUaString

        val cookieMap = JSONObject()
        var count = 0
        rawCookie.split(";").forEach { part ->
            val trimmed = part.trim()
            val eq = trimmed.indexOf('=')
            if (eq > 0) {
                val k = trimmed.substring(0, eq).trim()
                val v = trimmed.substring(eq + 1).trim()
                if (k.isNotEmpty()) {
                    cookieMap.put(k, v)
                    count++
                }
            }
        }

        val payload = JSONObject()
            .put("url", targetUrl)
            .put("userAgent", ua)
            .put("cookieHeader", rawCookie)
            .put("cookies", cookieMap)
            .put("capturedAt", System.currentTimeMillis())

        try {
            val workspaceDir = File(filesDir, "droidpy_workspace").apply { mkdirs() }
            val sessionJson = JSONObject()
                .put("url", targetUrl)
                .put("headers", JSONObject().put("User-Agent", ua))
                .put("cookies", cookieMap)
                .put("cookie_header", rawCookie)
            File(workspaceDir, "cookies.json").writeText(sessionJson.toString(2))
        } catch (_: Exception) {
        }

        val js = "window.dispatchEvent(new CustomEvent('droidpy-native-cookies', { detail: \${payload.toString()} }));"
        webView.evaluateJavascript(js, null)
        crawlerOverlay.visibility = View.GONE
        Toast.makeText(this, "已擷取 $count 筆 Cookie 並同步至 DroidPy", Toast.LENGTH_SHORT).show()
    }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildCrawlerOverlay(): LinearLayout {
        val overlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0F172A"))
            visibility = View.GONE
        }

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#1E293B"))
            setPadding(dp(6), dp(6), dp(6), dp(6))
        }

        fun navBtn(label: String, bg: Int, onClick: () -> Unit): Button = Button(this).apply {
            text = label
            setTextColor(Color.WHITE)
            setBackgroundColor(bg)
            textSize = 12f
            setPadding(dp(8), dp(4), dp(8), dp(4))
            minWidth = dp(36)
            minimumWidth = dp(36)
            setOnClickListener { onClick() }
        }

        val closeBtn = navBtn("✕", Color.parseColor("#334155")) {
            crawlerOverlay.visibility = View.GONE
        }
        val backBtn = navBtn("←", Color.parseColor("#334155")) {
            if (crawlerWebView.canGoBack()) crawlerWebView.goBack()
        }
        val reloadBtn = navBtn("↻", Color.parseColor("#334155")) {
            crawlerWebView.reload()
        }

        crawlerUrlInput = EditText(this).apply {
            hint = "https://..."
            setHintTextColor(Color.parseColor("#94A3B8"))
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#0F172A"))
            textSize = 12f
            setSingleLine(true)
            imeOptions = EditorInfo.IME_ACTION_GO
            setPadding(dp(8), dp(6), dp(8), dp(6))
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_DONE) {
                    val raw = text.toString().trim()
                    val url = if (raw.startsWith("http://") || raw.startsWith("https://")) raw else "https://$raw"
                    crawlerWebView.loadUrl(url)
                    true
                } else {
                    false
                }
            }
        }

        crawlerUaBtn = navBtn("Mobile", Color.parseColor("#475569")) {
            crawlerDesktopUa = !crawlerDesktopUa
            applyCrawlerUa()
            crawlerWebView.reload()
        }

        val captureBtn = Button(this).apply {
            text = "擷取 Cookie"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#E11D48"))
            typeface = Typeface.DEFAULT_BOLD
            textSize = 12f
            setPadding(dp(10), dp(4), dp(10), dp(4))
            setOnClickListener { captureCrawlerCookiesAndReturn() }
        }

        val btnLp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(36)).apply {
            marginEnd = dp(4)
        }
        val urlLp = LinearLayout.LayoutParams(0, dp(36), 1f).apply {
            marginEnd = dp(4)
        }

        toolbar.addView(closeBtn, btnLp)
        toolbar.addView(backBtn, btnLp)
        toolbar.addView(reloadBtn, btnLp)
        toolbar.addView(crawlerUrlInput, urlLp)
        toolbar.addView(crawlerUaBtn, btnLp)
        toolbar.addView(captureBtn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(36)))

        crawlerWebView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val target = request?.url?.toString() ?: return false
                    return !(target.startsWith("http://") || target.startsWith("https://"))
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (!url.isNullOrBlank()) {
                        crawlerUrlInput.setText(url)
                    }
                }
            }
        }

        overlay.addView(toolbar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        overlay.addView(crawlerWebView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        return overlay
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        rootContainer = FrameLayout(this)
        webView = WebView(this)
        crawlerOverlay = buildCrawlerOverlay()

        rootContainer.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        rootContainer.addView(crawlerOverlay, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(rootContainer)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.addJavascriptInterface(NativeDownloadBridge(), "DroidPyNative")
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost") || url.startsWith("file://")) {
                    return false
                }
                if (url.startsWith("https://") && url.contains(request.url?.host ?: "")) {
                    return false
                }
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                } catch (_: Exception) {
                    true
                }
            }
        }
        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            val fileName = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType)
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                val js = """
                    (function() {
                      fetch('$url').then(r => r.blob()).then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = function() {
                          window.DroidPyNative.saveBase64File(reader.result, '$fileName', blob.type || 'application/octet-stream');
                        };
                        reader.readAsDataURL(blob);
                      });
                    })();
                """.trimIndent()
                webView.evaluateJavascript(js, null)
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (crawlerOverlay.visibility == View.VISIBLE) {
                    if (crawlerWebView.canGoBack()) {
                        crawlerWebView.goBack()
                    } else {
                        crawlerOverlay.visibility = View.GONE
                    }
                } else if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        requestExternalStoragePermissionIfNeeded()

        val localWeb = File(filesDir, "www/index.html")
        val hasBundledWww = try {
            assets.list("www")?.contains("index.html") == true
        } catch (_: Exception) {
            false
        }

        thread {
            val usrDir = File(filesDir, "usr")
            val workspaceDir = File(filesDir, "droidpy_workspace").apply { mkdirs() }
            seedDefaultWorkspaceFiles(workspaceDir)

            localBridge = EmbeddedTermuxBridge(
                usrDir = usrDir,
                workspaceDir = workspaceDir,
                token = "${safeToken}",
                assetManager = assets
            ).also { it.start() }

            runOnUiThread {
                if (hasBundledWww) {
                    webView.loadUrl("http://127.0.0.1:8765/")
                } else if (localWeb.exists()) {
                    webView.loadUrl("file://" + localWeb.absolutePath)
                } else {
                    webView.loadUrl("${typeof window !== 'undefined' ? window.location.origin : 'https://localhost'}")
                }
            }

            if (!usrDir.exists()) {
                extractTermuxBootstrap(usrDir)
            }
        }
    }

    private fun requestExternalStoragePermissionIfNeeded() {
        ${
          opts.includeStoragePermission
            ? `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                    intent.data = Uri.parse("package:\$packageName")
                    startActivity(intent)
                } catch (_: Exception) {
                }
            }
        } else if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE), 1001)
        }`
            : '// Storage permission prompt disabled by export settings'
        }
    }

    private fun extractTermuxBootstrap(usrDir: File) {
        val tempDir = File(filesDir, "usr_tmp").apply {
            deleteRecursively()
            mkdirs()
        }
        assets.open("bootstrap-aarch64.zip").use { input ->
            ZipInputStream(input).use { zis ->
                var entry = zis.nextEntry
                val symlinks = mutableListOf<Pair<String, String>>()
                while (entry != null) {
                    if (entry.name == "SYMLINKS.txt") {
                        val content = zis.bufferedReader().readText()
                        content.lines().filter { it.contains("←") }.forEach { line ->
                            val parts = line.split("←")
                            if (parts.size == 2) symlinks.add(parts[0] to parts[1])
                        }
                    } else {
                        val outFile = File(tempDir, entry.name)
                        if (entry.isDirectory) {
                            outFile.mkdirs()
                        } else {
                            outFile.parentFile?.mkdirs()
                            outFile.outputStream().use { zis.copyTo(it) }
                            if (entry.name.startsWith("bin/") || entry.name.startsWith("libexec/")) {
                                outFile.setExecutable(true, false)
                            }
                        }
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
                symlinks.forEach { (target, linkPath) ->
                    try {
                        val link = File(tempDir, linkPath)
                        link.parentFile?.mkdirs()
                        android.system.Os.symlink(target, link.absolutePath)
                    } catch (_: Exception) {
                    }
                }
            }
        }
        tempDir.renameTo(usrDir)
    }

    private fun seedDefaultWorkspaceFiles(workspaceDir: File) {
        try {
            val bundled = assets.list("workspace") ?: return
            for (name in bundled) {
                val target = File(workspaceDir, name)
                if (!target.exists()) {
                    assets.open("workspace/$name").use { inp ->
                        target.outputStream().use { out -> inp.copyTo(out) }
                    }
                }
            }
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        localBridge?.stop()
        super.onDestroy()
    }
}
`
  );

  // 5. EmbeddedTermuxBridge.kt — runs inside the APK on 127.0.0.1:8765 using the embedded usr/bin/sh & python
  zip.file(
    `android/app/src/main/java/${pkgPath}/EmbeddedTermuxBridge.kt`,
    `package ${safePkg}

import android.content.res.AssetManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.util.concurrent.Executors

class EmbeddedTermuxBridge(
    private val usrDir: File,
    private val workspaceDir: File,
    private val token: String,
    private val port: Int = 8765,
    private val assetManager: AssetManager? = null
) {
    private var serverSocket: ServerSocket? = null
    private val executor = Executors.newCachedThreadPool()
    @Volatile private var running = false
    @Volatile private var activeProcess: Process? = null

    fun start() {
        if (running) return
        running = true
        serverSocket = ServerSocket(port, 32, InetAddress.getByName("127.0.0.1"))
        executor.execute {
            while (running) {
                try {
                    val client = serverSocket?.accept() ?: break
                    executor.execute { handleClient(client) }
                } catch (_: Exception) {
                    if (!running) break
                }
            }
        }
    }

    fun stop() {
        running = false
        activeProcess?.destroyForcibly()
        try { serverSocket?.close() } catch (_: Exception) {}
    }

    private fun ensurePrefixWrappers(): File {
        val homeDir = workspaceDir.parentFile!!
        val wrapperDir = File(homeDir, ".droidpy_bin").apply { mkdirs() }
        val prefix = usrDir.absolutePath
        val cert = File(usrDir, "etc/tls/cert.pem").absolutePath
        val d = '$'

        val pkgLines = listOf(
            "#!/system/bin/sh",
            "PREFIX=\\"$prefix\\"",
            "export PREFIX",
            "APT_OPTS=\\"-o Dir=\${d}PREFIX -o Dir::State=\${d}PREFIX/var/lib/apt -o Dir::State::status=\${d}PREFIX/var/lib/dpkg/status -o Dir::Cache=\${d}PREFIX/var/cache/apt -o Dir::Etc=\${d}PREFIX/etc/apt -o Dir::Etc::sourcelist=\${d}PREFIX/etc/apt/sources.list -o Dir::Etc::sourceparts=\${d}PREFIX/etc/apt/sources.list.d -o Dir::Bin::methods=\${d}PREFIX/lib/apt/methods -o Dir::Bin::dpkg=\${d}PREFIX/bin/dpkg -o DPkg::Options::=--admindir=\${d}PREFIX/var/lib/dpkg -o Acquire::AllowInsecureRepositories=true -o Acquire::https::CaInfo=$cert\\"",
            "mkdir -p \\"\${d}PREFIX/var/lib/apt/lists/partial\\" \\"\${d}PREFIX/var/cache/apt/archives/partial\\" \\"\${d}PREFIX/var/lib/dpkg/updates\\" \\"\${d}PREFIX/var/lib/dpkg/info\\"",
            "touch \\"\${d}PREFIX/var/lib/dpkg/status\\"",
            "SUB=\\"\${d}1\\"",
            "[ -z \\"\${d}SUB\\" ] && exit 1",
            "shift",
            "relocate_debs() {",
            "  STAGE=\\"\${d}PREFIX/tmp_pkg_stage\\"",
            "  for deb in \\"\${d}PREFIX/var/cache/apt/archives/\\"*.deb; do",
            "    [ -f \\"\${d}deb\\" ] || continue",
            "    rm -rf \\"\${d}STAGE\\" && mkdir -p \\"\${d}STAGE\\"",
            "    \\"\${d}PREFIX/bin/dpkg-deb\\" -x \\"\${d}deb\\" \\"\${d}STAGE\\" || continue",
            "    if [ -d \\"\${d}STAGE/data/data/com.termux/files/usr\\" ]; then",
            "      (\\"\${d}PREFIX/bin/cp\\" -af \\"\${d}STAGE/data/data/com.termux/files/usr/.\\" \\"\${d}PREFIX/\\" 2>/dev/null || cp -rf \\"\${d}STAGE/data/data/com.termux/files/usr/.\\" \\"\${d}PREFIX/\\")",
            "    fi",
            "    rm -f \\"\${d}deb\\"",
            "  done",
            "  rm -rf \\"\${d}STAGE\\"",
            "  chmod -R 755 \\"\${d}PREFIX/libexec\\" 2>/dev/null || true",
            "  for f in \\"\${d}PREFIX/bin/\\"*; do",
            "    [ -f \\"\${d}f\\" ] || continue",
            "    chmod 755 \\"\${d}f\\" 2>/dev/null || true",
            "    if head -c 40 \\"\${d}f\\" 2>/dev/null | grep -q \\"#!/data/data/com.termux/files/usr/bin/\\"; then",
            "      sed -i \\"1s|^#!/data/data/com.termux/files/usr/bin/|#!\${d}PREFIX/bin/|\\" \\"\${d}f\\" 2>/dev/null || true",
            "    fi",
            "  done",
            "}",
            "case \\"\${d}SUB\\" in",
            "  update)",
            "    \\"\${d}PREFIX/bin/apt-get\\" \${d}APT_OPTS update \\"\${d}@\\"",
            "    ;;",
            "  upgrade)",
            "    \\"\${d}PREFIX/bin/apt-get\\" \${d}APT_OPTS upgrade -y --download-only \\"\${d}@\\" && relocate_debs",
            "    ;;",
            "  install|reinstall)",
            "    \\"\${d}PREFIX/bin/apt-get\\" \${d}APT_OPTS install -y --download-only \\"\${d}@\\" && relocate_debs",
            "    ;;",
            "  search|show|list)",
            "    \\"\${d}PREFIX/bin/apt-cache\\" \${d}APT_OPTS \\"\${d}SUB\\" \\"\${d}@\\"",
            "    ;;",
            "  list-installed)",
            "    \\"\${d}PREFIX/bin/dpkg-query\\" --admindir=\\"\${d}PREFIX/var/lib/dpkg\\" -W \\"\${d}@\\"",
            "    ;;",
            "  *)",
            "    \\"\${d}PREFIX/bin/apt-get\\" \${d}APT_OPTS \\"\${d}SUB\\" \\"\${d}@\\"",
            "    ;;",
            "esac"
        )
        File(wrapperDir, "pkg").apply {
            writeText(pkgLines.joinToString("\\n") + "\\n")
            setExecutable(true, false)
        }
        val pipScript = "#!/system/bin/sh\\nexec \\"$prefix/bin/python\\" -m pip \\"\${d}@\\"\\n"
        File(wrapperDir, "pip").apply {
            writeText(pipScript)
            setExecutable(true, false)
        }
        File(wrapperDir, "pip3").apply {
            writeText(pipScript)
            setExecutable(true, false)
        }
        return wrapperDir
    }

    private fun buildEnv(): Map<String, String> {
        val wrapperBin = ensurePrefixWrappers().absolutePath
        val bin = File(usrDir, "bin").absolutePath
        val lib = File(usrDir, "lib").absolutePath
        val cert = File(usrDir, "etc/tls/cert.pem").absolutePath
        return mapOf(
            "PREFIX" to usrDir.absolutePath,
            "HOME" to workspaceDir.parentFile!!.absolutePath,
            "PATH" to "$wrapperBin:$bin:/system/bin",
            "LD_LIBRARY_PATH" to lib,
            "TMPDIR" to File(workspaceDir.parentFile, "tmp").apply { mkdirs() }.absolutePath,
            "PYTHONUNBUFFERED" to "1",
            "TERM" to "xterm-256color",
            "LANG" to "en_US.UTF-8",
            "SSL_CERT_FILE" to cert,
            "CURL_CA_BUNDLE" to cert,
            "REQUESTS_CA_BUNDLE" to cert,
            "PIP_CERT" to cert
        )
    }

    private fun handleClient(socket: Socket) {
        socket.use { sock ->
            val reader = BufferedReader(InputStreamReader(sock.getInputStream()))
            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return
            val method = parts[0]
            val path = parts[1].substringBefore("?")

            val headers = mutableMapOf<String, String>()
            var line: String?
            while (reader.readLine().also { line = it } != null && line!!.isNotEmpty()) {
                val idx = line!!.indexOf(":")
                if (idx > 0) {
                    headers[line!!.substring(0, idx).trim().lowercase()] = line!!.substring(idx + 1).trim()
                }
            }

            val out = sock.getOutputStream()
            if (method == "OPTIONS") {
                writeHeaders(out, 204, "text/plain", 0)
                return
            }

            val apiRoutes = setOf(
                "/health",
                "/stdin",
                "/stop",
                "/run-stream",
                "/install-stream",
                "/shell-stream",
                "/files",
                "/probe-url"
            )
            if (method == "GET" && path !in apiRoutes && serveBundledWebAsset(out, path)) {
                return
            }

            if (headers["x-droidpy-token"] != token) {
                writeJson(out, 401, JSONObject().put("error", "Invalid token"))
                return
            }

            val len = headers["content-length"]?.toIntOrNull() ?: 0
            val bodyChars = CharArray(len)
            var readTotal = 0
            while (readTotal < len) {
                val r = reader.read(bodyChars, readTotal, len - readTotal)
                if (r < 0) break
                readTotal += r
            }
            val bodyJson = if (len > 0) JSONObject(String(bodyChars, 0, readTotal)) else JSONObject()

            when {
                method == "GET" && path == "/health" -> {
                    val hasPython = File(usrDir, "bin/python").exists()
                    val res = JSONObject()
                        .put("ok", true)
                        .put("streaming", true)
                        .put("embedded", true)
                        .put("hasPython", hasPython)
                        .put("pythonVersion", if (hasPython) "Termux Embedded" else "Bootstrap Ready")
                        .put("arch", System.getProperty("os.arch") ?: "aarch64")
                        .put("hasClang", File(usrDir, "bin/clang").exists())
                        .put("hasFfmpeg", File(usrDir, "bin/ffmpeg").exists())
                        .put("workspaceDir", workspaceDir.absolutePath)
                    writeJson(out, 200, res)
                }

                method == "POST" && path == "/stdin" -> {
                    val data = bodyJson.optString("data", "") + "\\n"
                    val proc = activeProcess
                    if (proc == null) {
                        writeJson(out, 409, JSONObject().put("error", "No active process"))
                    } else {
                        proc.outputStream.write(data.toByteArray())
                        proc.outputStream.flush()
                        writeJson(out, 200, JSONObject().put("ok", true))
                    }
                }

                method == "POST" && path == "/stop" -> {
                    activeProcess?.destroyForcibly()
                    writeJson(out, 200, JSONObject().put("ok", true))
                }

                method == "POST" && (path == "/run-stream" || path == "/install-stream" || path == "/shell-stream") -> {
                    val shellCmd = when (path) {
                        "/run-stream" -> {
                            val arr = bodyJson.optJSONArray("files") ?: JSONArray()
                            for (i in 0 until arr.length()) {
                                val f = arr.getJSONObject(i)
                                val name = File(f.getString("name")).name
                                File(workspaceDir, name).writeText(f.getString("content"))
                            }
                            val entry = File(bodyJson.optString("entry", "main.py")).name
                            val pyPath = File(usrDir, "bin/python").absolutePath
                            "if [ ! -x \\"$pyPath\\" ]; then echo \\"[DroidPy] Python not initialized yet. Tap One-Tap Init in Termux Bridge.\\"; exit 127; fi; exec \\"$pyPath\\" -u \\"$entry\\""
                        }
                        "/install-stream" -> {
                            val mode = bodyJson.optString("mode", "pip")
                            val target = bodyJson.optString("target", "").trim()
                            if (mode == "pkg") "pkg install -y $target" else "pip install $target"
                        }
                        else -> bodyJson.optString("command", "")
                    }
                    streamShellCommand(out, shellCmd)
                }

                method == "GET" && path == "/files" -> {
                    val allowed = listOf(".py", ".json", ".csv", ".txt", ".md", ".html", ".xml", ".yaml", ".yml", ".ini", ".cfg", ".log", ".sh", ".toml")
                    val arr = JSONArray()
                    workspaceDir.listFiles()?.sortedBy { it.name }?.forEach { f ->
                        if (f.isFile && !f.name.startsWith(".") && f.length() <= 180 * 1024) {
                            val lower = f.name.lowercase()
                            if (allowed.any { lower.endsWith(it) } || f.name == "requirements.txt") {
                                try {
                                    arr.put(
                                        JSONObject()
                                            .put("name", f.name)
                                            .put("content", f.readText(Charsets.UTF_8))
                                            .put("updatedAt", f.lastModified())
                                    )
                                } catch (_: Exception) {
                                }
                            }
                        }
                    }
                    writeJson(out, 200, JSONObject().put("files", arr))
                }

                method == "POST" && path == "/probe-url" -> {
                    val targetUrl = bodyJson.optString("url", "").trim()
                    if (targetUrl.isEmpty()) {
                        writeJson(out, 400, JSONObject().put("error", "Missing URL"))
                    } else {
                        try {
                            val ua = bodyJson.optString("userAgent", "").ifBlank {
                                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
                            }
                            val cookieHdr = bodyJson.optString("cookieHeader", "")
                            val extraHdrs = bodyJson.optJSONObject("extraHeaders")
                            val conn = (URL(targetUrl).openConnection() as HttpURLConnection).apply {
                                requestMethod = "GET"
                                instanceFollowRedirects = true
                                connectTimeout = 15000
                                readTimeout = 18000
                                setRequestProperty("User-Agent", ua)
                                if (extraHdrs != null) {
                                    val keys = extraHdrs.keys()
                                    while (keys.hasNext()) {
                                        val k = keys.next()
                                        val v = extraHdrs.optString(k, "")
                                        if (k.isNotBlank() && v.isNotBlank()) {
                                            setRequestProperty(k, v)
                                        }
                                    }
                                }
                                if (cookieHdr.isNotBlank()) setRequestProperty("Cookie", cookieHdr)
                            }
                            val code = conn.responseCode
                            val stream = if (code >= 400) conn.errorStream else conn.inputStream
                            val bodyText = stream?.bufferedReader(Charsets.UTF_8)?.use { r ->
                                val buf = CharArray(16000)
                                val n = r.read(buf)
                                if (n > 0) String(buf, 0, n) else ""
                            } ?: ""
                            val setCookies = JSONArray()
                            val respHeaders = JSONObject()
                            conn.headerFields.forEach { (k, vals) ->
                                if (k != null) {
                                    if (k.equals("Set-Cookie", ignoreCase = true)) {
                                        vals.forEach { setCookies.put(it) }
                                    } else if (vals.isNotEmpty()) {
                                        respHeaders.put(k, vals.joinToString(", "))
                                    }
                                }
                            }
                            val titleMatch = Regex("<title[^>]*>(.*?)</title>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)).find(bodyText)
                            val title = titleMatch?.groupValues?.getOrNull(1)?.replace(Regex("\\\\s+"), " ")?.trim() ?: ""
                            val res = JSONObject()
                                .put("ok", code in 200..399)
                                .put("url", targetUrl)
                                .put("finalUrl", conn.url?.toString() ?: targetUrl)
                                .put("statusCode", code)
                                .put("title", title)
                                .put("setCookies", setCookies)
                                .put("headers", respHeaders)
                                .put("bodyPreview", bodyText.take(8000))
                            writeJson(out, 200, res)
                        } catch (e: Exception) {
                            writeJson(out, 502, JSONObject().put("error", e.message ?: "Probe failed"))
                        }
                    }
                }

                else -> writeJson(out, 404, JSONObject().put("error", "Not found"))
            }
        }
    }

    private fun streamShellCommand(out: OutputStream, command: String) {
        val t0 = System.currentTimeMillis()
        val shFile = File(usrDir, "bin/sh")

        out.write((
            "HTTP/1.1 200 OK\\r\\n" +
            corsHeaders() +
            "Content-Type: application/x-ndjson; charset=utf-8\\r\\n" +
            "Connection: close\\r\\n\\r\\n"
        ).toByteArray())
        out.flush()

        fun sendStdout(text: String) {
            val line = JSONObject().put("type", "stdout").put("data", text).toString() + "\\n"
            out.write(line.toByteArray(Charsets.UTF_8))
            out.flush()
        }

        if (!shFile.exists()) {
            sendStdout("[DroidPy] Waiting for Termux bootstrap extraction...\\n")
            var waited = 0
            while (!shFile.exists() && waited < 25000) {
                try { Thread.sleep(250) } catch (_: InterruptedException) { break }
                waited += 250
            }
        }

        var code = 1
        if (!shFile.exists()) {
            sendStdout("[DroidPy] Bootstrap not ready at \${shFile.absolutePath}\\n")
        } else {
            try {
                val pb = ProcessBuilder(shFile.absolutePath, "-c", command)
                pb.directory(workspaceDir)
                pb.redirectErrorStream(true)
                pb.environment().putAll(buildEnv())

                val proc = pb.start()
                activeProcess = proc
                val buf = ByteArray(2048)
                val inp = proc.inputStream
                while (true) {
                    val n = inp.read(buf)
                    if (n <= 0) break
                    sendStdout(String(buf, 0, n, Charsets.UTF_8))
                }
                code = proc.waitFor()
            } catch (e: Exception) {
                sendStdout("[DroidPy] Exec error: \${e.message}\\n")
            } finally {
                activeProcess = null
            }
        }

        val doneLine = JSONObject()
            .put("type", "done")
            .put("exitCode", code)
            .put("durationMs", System.currentTimeMillis() - t0)
            .toString() + "\\n"
        out.write(doneLine.toByteArray(Charsets.UTF_8))
        out.flush()
    }

    private fun corsHeaders(): String =
        "Access-Control-Allow-Origin: *\\r\\n" +
        "Access-Control-Allow-Private-Network: true\\r\\n" +
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\\r\\n" +
        "Access-Control-Allow-Headers: Content-Type, X-DroidPy-Token\\r\\n"

    private fun serveBundledWebAsset(out: OutputStream, requestPath: String): Boolean {
        val mgr = assetManager ?: return false
        val rel = requestPath.trimStart('/').trimEnd('/')
        if (rel.contains("..")) return false
        val candidate = rel.ifEmpty { "index.html" }

        fun readAssetBytes(assetRel: String): ByteArray? = try {
            mgr.open("www/$assetRel").use { it.readBytes() }
        } catch (_: Exception) {
            null
        }

        var resolvedPath = candidate
        var bytes = readAssetBytes(resolvedPath)
        if (bytes == null && !candidate.substringAfterLast('/', "").contains('.')) {
            resolvedPath = "index.html"
            bytes = readAssetBytes(resolvedPath)
        }
        if (bytes == null) return false

        writeHeaders(out, 200, mimeTypeForPath(resolvedPath), bytes.size)
        out.write(bytes)
        out.flush()
        return true
    }

    private fun mimeTypeForPath(path: String): String {
        val lower = path.lowercase()
        return when {
            lower.endsWith(".html") -> "text/html; charset=utf-8"
            lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript; charset=utf-8"
            lower.endsWith(".css") -> "text/css; charset=utf-8"
            lower.endsWith(".json") || lower.endsWith(".webmanifest") -> "application/json; charset=utf-8"
            lower.endsWith(".svg") -> "image/svg+xml"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
            lower.endsWith(".ico") -> "image/x-icon"
            lower.endsWith(".wasm") -> "application/wasm"
            lower.endsWith(".woff2") -> "font/woff2"
            lower.endsWith(".txt") -> "text/plain; charset=utf-8"
            else -> "application/octet-stream"
        }
    }

    private fun statusReason(status: Int): String = when (status) {
        200 -> "OK"
        204 -> "No Content"
        400 -> "Bad Request"
        401 -> "Unauthorized"
        404 -> "Not Found"
        409 -> "Conflict"
        502 -> "Bad Gateway"
        else -> "OK"
    }

    private fun writeHeaders(out: OutputStream, status: Int, contentType: String, length: Int) {
        out.write((
            "HTTP/1.1 $status \${statusReason(status)}\\r\\n" +
            corsHeaders() +
            "Content-Type: $contentType\\r\\n" +
            "Content-Length: $length\\r\\n" +
            "Connection: close\\r\\n\\r\\n"
        ).toByteArray())
        out.flush()
    }

    private fun writeJson(out: OutputStream, status: Int, json: JSONObject) {
        val bytes = json.toString().toByteArray(Charsets.UTF_8)
        writeHeaders(out, status, "application/json; charset=utf-8", bytes.size)
        out.write(bytes)
        out.flush()
    }
}
`
  );

  // 6. Seed user's current Python workspace files into android/app/src/main/assets/workspace/
  for (const file of opts.files) {
    zip.file(`android/app/src/main/assets/workspace/${file.name}`, file.content);
  }

  // 7. README.md (rendered automatically by GitHub) + README_GITHUB_APK.md
  const githubApkReadme = `# ${safeTitle} 獨立 Android APK（GitHub 自動打包專案）

本專案已預先配置好 **GitHub Actions 自動編譯流程**、**內嵌 Termux Bootstrap 環境** 與 **原生爬蟲瀏覽器（Cookie 擷取）**：
打包成 APK 安裝至手機後，**無須另外安裝 Termux App**，也不受瀏覽器 CORS 限制，可直接執行 Python 網路爬蟲（\`requests\`、\`beautifulsoup4\`、\`lxml\`、\`yt-dlp\`）、\`ffmpeg\` 與 \`clang\` 原生套件。

## 發布與自動打包步驟

1. 在 GitHub 建立一個新的公開或私人倉庫（Repository）。
2. 將本壓縮檔解壓縮後的所有檔案（包含 \`.github/\` 與 \`android/\`）上傳／Push 到該倉庫的 \`main\` 分支。
   - 若倉庫同時包含前端原始碼（\`package.json\`），Workflow 會自動執行 \`npm ci && npm run build\` 並複製進 \`android/app/src/main/assets/www/\` 打包為完全離線 APK。
3. 點擊 GitHub 倉庫上方的 **Actions** 頁籤，等待 **Build DroidPy Android APK** 工作流程跑完（雲端會自動下載最新版 \`bootstrap-aarch64.zip\` 並編譯出 ARM64 APK）。
4. 在 Actions 執行結果頁面最下方的 **Artifacts** 下載 \`.apk\` 檔案（或推送 \`v1.0.0\` Tag 自動發佈至 **GitHub Releases**），傳到 Android 手機安裝即可。

## 首次開啟 App 初始化說明

1. APK 首次啟動時會自動將內嵌 Termux Bootstrap 解壓至 App 私有目錄並啟動 \`127.0.0.1:8765\` 橋接服務。
2. 開啟 DroidPy 後進入 **「Termux 橋接」**，點擊 **「一鍵初始化 Python + 爬蟲環境」**，系統將自動安裝：
   \`pkg update -y && pkg install -y python clang libxml2 libxslt && pip install requests beautifulsoup4 lxml httpx\`
3. 如需抓取需登入的網站資料，開啟 **「爬蟲瀏覽器」** → 點擊 **「APK 原生瀏覽器登入抓 Cookie」** 完成登入並點右上角 **「擷取 Cookie」**，即可直接讀取包含 \`HttpOnly\` 的認證 Cookie 並寫入工作區 \`cookies.json\`。
`;

  const changelogContent = `# Changelog / 更新日誌

## [1.2.0] - 2026-11-21
- 新增 \`.droidpy_bin\` 跨包名 Termux 前綴轉接層（\`pkg\` / \`pip\`），讓獨立 APK 可於自有沙盒目錄安裝 \`python\`、\`clang\`、\`libxml2\`、\`libxslt\`、\`ffmpeg\` 與 pip 套件。
- 修正 APK 離線前端靜態伺服（\`http://127.0.0.1:8765/\`）、Android \`adjustResize\` 虛擬鍵盤避讓與零孤兒進程停止（\`exec python -u\`）。
- 修正 GitHub Actions Workflow（支援 \`v*\` Tag 觸發、指定 Gradle 8.7、彈性 \`npm ci / npm install\`）並自動附帶本更新日誌發佈 GitHub Releases。
`;

  zip.file('README.md', githubApkReadme);
  zip.file('README_GITHUB_APK.md', githubApkReadme);
  zip.file('CHANGELOG.md', changelogContent);

  return zip.generateAsync({ type: 'blob' });
}
