import JSZip from 'jszip';
import { PythonFile } from '../types/ide';
import {
  ANDROID_ADAPTIVE_ICON_XML,
  ANDROID_ICON_BACKGROUND_XML,
  ANDROID_ICON_FOREGROUND_XML,
  ANDROID_MIPMAP_PNG_BASE64,
} from './androidIconAssets';

export interface GitHubApkBundleOptions {
  appTitle: string;
  packageId: string;
  includeStoragePermission: boolean;
  files: PythonFile[];
}

export async function generateGitHubApkProjectZip(opts: GitHubApkBundleOptions): Promise<Blob> {
  const zip = new JSZip();
  const safeTitle = opts.appTitle.trim() || 'DroidPy';
  const safeKotlinTitle = safeTitle.replace(/["\\]/g, '');
  const safePkg = opts.packageId.trim() || 'org.droidpy.app';
  const pkgPath = safePkg.replace(/\./g, '/');

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
    inputs:
      release_tag:
        description: 'Optional release tag, for example v1.2.3. Leave empty for a debug build.'
        required: false
        type: string

permissions:
  contents: read

jobs:
  build-apk:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      is_release: \${{ steps.configure.outputs.is_release }}
      release_tag: \${{ steps.configure.outputs.release_tag }}
      artifact_name: \${{ steps.configure.outputs.artifact_name }}
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
        env:
          VITE_GITHUB_REPO: \${{ github.repository }}
        run: |
          set -euo pipefail
          if [ -f package.json ]; then
            if [ -f package-lock.json ]; then
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
          set -euo pipefail
          mkdir -p android/app/src/main/assets
          curl -fL https://github.com/termux/termux-packages/releases/latest/download/bootstrap-aarch64.zip -o android/app/src/main/assets/bootstrap-aarch64.zip

      - name: Configure version and protected signing
        id: configure
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          CUSTOM_KS_B64: \${{ secrets.DROIDPY_KEYSTORE_BASE64 }}
          CUSTOM_STORE_PASS: \${{ secrets.DROIDPY_STORE_PASSWORD }}
          CUSTOM_KEY_ALIAS: \${{ secrets.DROIDPY_KEY_ALIAS }}
          CUSTOM_KEY_PASS: \${{ secrets.DROIDPY_KEY_PASSWORD }}
          INPUT_RELEASE_TAG: \${{ inputs.release_tag }}
        run: |
          set -euo pipefail
          INPUT_TAG="\${INPUT_RELEASE_TAG:-}"
          if [ -n "$INPUT_TAG" ] && ! [[ "$INPUT_TAG" =~ ^v?[0-9]+[.][0-9]+[.][0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
            echo '::error::release_tag must be a valid version such as v1.2.3'
            exit 1
          fi
          IS_RELEASE_REF=false
          if [ "$GITHUB_EVENT_NAME" = push ]; then
            case "$GITHUB_REF" in
              refs/heads/main|refs/heads/master|refs/tags/v*) IS_RELEASE_REF=true ;;
            esac
          elif [ "$GITHUB_EVENT_NAME" = workflow_dispatch ] && [ -n "$INPUT_TAG" ]; then
            IS_RELEASE_REF=true
          fi
          VER=$(grep -m1 -oE '[0-9]+[.][0-9]+[.][0-9]+' CHANGELOG.md 2>/dev/null | head -n1 || true)
          if [ -z "$VER" ]; then VER="1.2.16"; fi
          if [ -n "$INPUT_TAG" ]; then
            REL_TAG="v\${INPUT_TAG#v}"
            VNAME="\${REL_TAG#v}"
          elif [[ "$GITHUB_REF" == refs/tags/* ]]; then
            REL_TAG="$GITHUB_REF_NAME"
            VNAME="\${REL_TAG#v}"
          elif [ "$IS_RELEASE_REF" = true ]; then
            IFS='.' read -r MAJ MIN PAT <<< "$VER"
            MAJ=\${MAJ:-1}; MIN=\${MIN:-2}; PAT=\${PAT:-0}
            for _ in $(seq 1 50); do
              CAND_TAG="v\${MAJ}.\${MIN}.\${PAT}"
              REL_EXISTS=0
              if gh release view "$CAND_TAG" >/dev/null 2>&1; then REL_EXISTS=1; fi
              TAG_SHA=$(git ls-remote --tags origin "refs/tags/\${CAND_TAG}^{}" 2>/dev/null | awk '{print $1}' | head -n1 || true)
              if [ -z "$TAG_SHA" ]; then TAG_SHA=$(git ls-remote --tags origin "refs/tags/\${CAND_TAG}" 2>/dev/null | awk '{print $1}' | head -n1 || true); fi
              if [ "$REL_EXISTS" -eq 0 ] && [ -z "$TAG_SHA" ]; then break; fi
              if [ -n "$TAG_SHA" ] && [ "$TAG_SHA" = "$GITHUB_SHA" ]; then break; fi
              PAT=$((PAT + 1))
            done
            VNAME="\${MAJ}.\${MIN}.\${PAT}"
            REL_TAG="v$VNAME"
          else
            REL_TAG="debug-$GITHUB_RUN_NUMBER"
            VNAME="$VER"
          fi
          SEMVER_PART=$(printf '%s' "$VNAME" | grep -oE '^[0-9]+[.][0-9]+[.][0-9]+' || echo '1.2.16')
          IFS='.' read -r CMAJ CMIN CPAT <<< "$SEMVER_PART"
          VCODE=$(( \${CMAJ:-1} * 10000 + \${CMIN:-0} * 100 + \${CPAT:-0} ))
          echo "DROIDPY_VERSION_CODE=$VCODE" >> "$GITHUB_ENV"
          echo "DROIDPY_VERSION_NAME=$VNAME" >> "$GITHUB_ENV"
          echo "DROIDPY_RESOLVED_TAG=$REL_TAG" >> "$GITHUB_ENV"
          echo "DROIDPY_RELEASE_BUILD=$IS_RELEASE_REF" >> "$GITHUB_ENV"
          if [ "$IS_RELEASE_REF" = true ]; then
            if [ -z "$CUSTOM_KS_B64" ]; then
              echo '::error::The new DROIDPY_KEYSTORE_BASE64 secret is required for Release builds.'
              exit 1
            fi
            CUSTOM_STORE_PASS="\${CUSTOM_STORE_PASS:-android}"
            CUSTOM_KEY_ALIAS="\${CUSTOM_KEY_ALIAS:-androiddebugkey}"
            CUSTOM_KEY_PASS="\${CUSTOM_KEY_PASS:-android}"
            printf '%s' "$CUSTOM_KS_B64" | base64 --decode > android/app/droidpy-release.keystore
            keytool -list -keystore android/app/droidpy-release.keystore -storepass "$CUSTOM_STORE_PASS" -alias "$CUSTOM_KEY_ALIAS" >/dev/null
            echo 'DROIDPY_KEYSTORE_FILE=droidpy-release.keystore' >> "$GITHUB_ENV"
            printf 'DROIDPY_STORE_PASSWORD=%s\\n' "$CUSTOM_STORE_PASS" >> "$GITHUB_ENV"
            printf 'DROIDPY_KEY_ALIAS=%s\\n' "$CUSTOM_KEY_ALIAS" >> "$GITHUB_ENV"
            printf 'DROIDPY_KEY_PASSWORD=%s\\n' "$CUSTOM_KEY_PASS" >> "$GITHUB_ENV"
            ACTUAL_KEYSTORE_SHA256=$(keytool -exportcert -keystore android/app/droidpy-release.keystore -storepass "$CUSTOM_STORE_PASS" -alias "$CUSTOM_KEY_ALIAS" | sha256sum | awk '{print toupper($1)}')
            echo "DROIDPY_EXPECTED_CERT_SHA256=$ACTUAL_KEYSTORE_SHA256" >> "$GITHUB_ENV"
            echo "Verified protected Release signing certificate: $ACTUAL_KEYSTORE_SHA256"
          else
            echo 'PR/debug builds use the temporary Android debug signer and do not require Release secrets.'
          fi
          echo "is_release=$IS_RELEASE_REF" >> "$GITHUB_OUTPUT"
          echo "release_tag=$REL_TAG" >> "$GITHUB_OUTPUT"
          echo "artifact_name=${appSlug}-arm64-apk-$GITHUB_RUN_NUMBER-a\${GITHUB_RUN_ATTEMPT:-1}" >> "$GITHUB_OUTPUT"

      - name: Build Debug APK (Arm64)
        working-directory: android
        run: gradle assembleDebug --no-daemon

      - name: Build Release APK (Arm64)
        if: steps.configure.outputs.is_release == 'true'
        working-directory: android
        run: gradle assembleRelease --no-daemon

      - name: Verify APK signature
        run: |
          set -euo pipefail
          APK_DIR=android/app/build/outputs/apk/debug
          if [ "$DROIDPY_RELEASE_BUILD" = true ]; then APK_DIR=android/app/build/outputs/apk/release; fi
          APK_PATH=$(find "$APK_DIR" -maxdepth 1 -type f -name '*.apk' -print | sort | head -n1)
          if [ -z "$APK_PATH" ]; then echo '::error::No APK found.'; exit 1; fi
          APKSIGNER=$(find "\${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}/build-tools" -type f -name apksigner -perm -u+x 2>/dev/null | sort -V | tail -n1)
          if [ -z "$APKSIGNER" ]; then echo '::error::Android apksigner not found.'; exit 1; fi
          SIGNER_OUTPUT=$("$APKSIGNER" verify --verbose --print-certs "$APK_PATH" 2>&1)
          printf '%s\\n' "$SIGNER_OUTPUT"
          ACTUAL_SHA256=$(printf '%s\\n' "$SIGNER_OUTPUT" | sed -nE 's/.*certificate SHA-256 digest: *([0-9A-Fa-f:]+).*/\\1/ip' | head -n1 | tr -d ':' | tr '[:lower:]' '[:upper:]')
          if ! [[ "$ACTUAL_SHA256" =~ ^[0-9A-F]{64}$ ]]; then echo '::error::Invalid APK signer fingerprint.'; exit 1; fi
          if [ "$DROIDPY_RELEASE_BUILD" = true ]; then
            EXPECTED_SHA256="\${DROIDPY_EXPECTED_CERT_SHA256:-}"
            if ! [[ "$EXPECTED_SHA256" =~ ^[0-9A-F]{64}$ ]] || [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
              echo '::error::Release APK signer does not match the protected keystore.'
              exit 1
            fi
            echo "Verified protected Release APK signer: $ACTUAL_SHA256"
          else
            echo "Verified PR/debug APK signature structure: $ACTUAL_SHA256"
          fi

      - name: Prepare APK Artifact
        run: |
          set -euo pipefail
          mkdir -p release-apk
          if [ "$DROIDPY_RELEASE_BUILD" = true ]; then
            cp android/app/build/outputs/apk/release/*.apk "release-apk/${appSlug}-arm64-\${DROIDPY_RESOLVED_TAG}.apk"
          else
            cp android/app/build/outputs/apk/debug/*.apk "release-apk/${appSlug}-arm64-debug-$GITHUB_RUN_NUMBER.apk"
          fi

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: \${{ steps.configure.outputs.artifact_name }}
          retention-days: 90
          overwrite: true
          path: release-apk/*.apk

  publish-release:
    if: needs.build-apk.outputs.is_release == 'true'
    needs: build-apk
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Download verified APK artifact
        uses: actions/download-artifact@v4
        with:
          name: \${{ needs.build-apk.outputs.artifact_name }}
          path: release-apk

      - name: Publish GitHub Release
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          RELEASE_TAG: \${{ needs.build-apk.outputs.release_tag }}
        run: |
          set -euo pipefail
          APK_FILE=$(find release-apk -maxdepth 1 -type f -name '*.apk' -print | head -n1)
          if [ -z "$APK_FILE" ]; then echo '::error::Verified Release APK artifact is missing.'; exit 1; fi
          if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
            gh release upload "$RELEASE_TAG" "$APK_FILE" --clobber
          else
            gh release create "$RELEASE_TAG" "$APK_FILE" --title "${appSlug} $RELEASE_TAG" --notes-file CHANGELOG.md --target "$GITHUB_SHA"
          fi`
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
        versionCode = System.getenv("DROIDPY_VERSION_CODE")?.toIntOrNull() ?: 10216
        versionName = System.getenv("DROIDPY_VERSION_NAME")?.takeIf { it.isNotBlank() } ?: "1.2.16"

        ndk {
            abiFilters += listOf("arm64-v8a")
        }
    }

    signingConfigs {
        create("droidpy") {
            val customPath = System.getenv("DROIDPY_KEYSTORE_FILE")?.takeIf { it.isNotBlank() }
            val ksFile = if (customPath != null) file(customPath) else file("droidpy-debug.p12")
            if (ksFile.exists()) {
                storeFile = ksFile
                storePassword = System.getenv("DROIDPY_STORE_PASSWORD")?.takeIf { it.isNotBlank() } ?: "android"
                keyAlias = System.getenv("DROIDPY_KEY_ALIAS")?.takeIf { it.isNotBlank() } ?: "androiddebugkey"
                keyPassword = System.getenv("DROIDPY_KEY_PASSWORD")?.takeIf { it.isNotBlank() } ?: "android"
            }
        }
    }

    buildTypes {
        getByName("debug") {
            val cfg = signingConfigs.findByName("droidpy")
            if (cfg?.storeFile?.exists() == true) {
                signingConfig = cfg
            }
        }
        getByName("release") {
            isMinifyEnabled = false
            val cfg = signingConfigs.findByName("droidpy")
            if (cfg?.storeFile?.exists() == true) {
                signingConfig = cfg
            }
        }
    }

    // GitHub sideload builds retain targetSdk 28 for the embedded Termux runtime.
    // Suppress only the Play Store target-age lint; this does not imply Play Store compliance.
    lint {
        disable += "ExpiredTargetSdkVersion"
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

  // 3. AndroidManifest.xml with full network (crawler) & unconditional open storage permissions
  const storagePerms = `    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />`;

  zip.file(
    'android/app/src/main/AndroidManifest.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
${storagePerms}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="${safeTitle}"
        android:usesCleartextTraffic="true"
        android:requestLegacyExternalStorage="true"
        android:preserveLegacyExternalStorage="true"
        android:theme="@style/Theme.AppCompat.DayNight.NoActionBar">
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${safePkg}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
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

  zip.file(
    'android/app/src/main/res/xml/file_paths.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<paths>
    <files-path name="updates" path="updates/" />
</paths>
`
  );

  // 4. MainActivity.kt (hosts DroidPy WebView + starts embedded Termux Bootstrap server)
  zip.file(
    `android/app/src/main/java/${pkgPath}/MainActivity.kt`,
    `package ${safePkg}

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.SystemClock
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
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import javax.net.ssl.HttpsURLConnection
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
    private var trustedAppOrigin: String? = null
    private var trustedLocalWebPath: String? = null
    private var lastBackPressedAt: Long = 0L
    private var exitToast: Toast? = null
    private val stateIoExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
    private val bridgeToken: String by lazy { loadOrCreateBridgeToken() }

    private fun loadOrCreateBridgeToken(): String {
        val tokenFile = File(filesDir, "droidpy_bridge_token")
        val existing = try {
            tokenFile.readText(Charsets.US_ASCII).trim()
        } catch (_: Exception) {
            ""
        }
        if (Regex("^[a-fA-F0-9]{64}$").matches(existing)) {
            return existing.lowercase()
        }

        val randomBytes = ByteArray(32)
        java.security.SecureRandom().nextBytes(randomBytes)
        val token = randomBytes.joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
        val tempFile = File(filesDir, "droidpy_bridge_token.tmp")
        try {
            tempFile.writeText(token, Charsets.US_ASCII)
            if (!tempFile.renameTo(tokenFile)) {
                tokenFile.writeText(token, Charsets.US_ASCII)
                tempFile.delete()
            }
        } catch (error: Exception) {
            tempFile.delete()
            throw IllegalStateException("Unable to persist the per-install DroidPy bridge token", error)
        }
        return token
    }

    private val mobileUaString =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
    private val desktopUaString =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    private fun normalizedOrigin(uri: Uri): String? {
        val scheme = uri.scheme?.lowercase() ?: return null
        val host = uri.host?.lowercase() ?: return null
        val port = if (uri.port >= 0) uri.port else when (scheme) {
            "http" -> 80
            "https" -> 443
            else -> return null
        }
        return "$scheme://$host:$port"
    }

    private fun isTrustedAppNavigation(uri: Uri): Boolean {
        if (uri.scheme.equals("file", ignoreCase = true)) {
            val expectedPath = trustedLocalWebPath ?: return false
            val actualPath = try {
                File(uri.path ?: return false).canonicalPath
            } catch (_: Exception) {
                return false
            }
            return actualPath == expectedPath
        }
        val expectedOrigin = trustedAppOrigin ?: return false
        return normalizedOrigin(uri) == expectedOrigin
    }

    inner class NativeDownloadBridge {
        @JavascriptInterface
        fun isNativeApp(): Boolean = true

        @JavascriptInterface
        fun getBridgeToken(): String = bridgeToken

        @JavascriptInterface
        fun getAppVersionName(): String {
            return try {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, 0).versionName ?: "1.2.14"
            } catch (_: Exception) {
                "1.2.14"
            }
        }

        @JavascriptInterface
        fun copyToClipboard(text: String): Boolean {
            return try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("DroidPy", text))
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun downloadAndInstallApk(apkUrl: String, fileName: String) {
            val safeName = File(fileName).name.ifBlank { "DroidPy-update.apk" }.let {
                if (it.lowercase().endsWith(".apk")) it else "$it.apk"
            }
            val maxApkBytes = 300L * 1024L * 1024L
            var activeConnection: HttpURLConnection? = null
            var partialFile: File? = null

            fun emitProgress(status: String, progress: Int, downloaded: Long = 0L, total: Long = 0L, message: String = "") {
                val payload = JSONObject()
                    .put("status", status)
                    .put("progress", progress)
                    .put("downloadedBytes", downloaded)
                    .put("totalBytes", total)
                    .put("fileName", safeName)
                    .put("message", message)
                val js = "window.dispatchEvent(new CustomEvent('droidpy-apk-download', { detail: \${payload.toString()} }));"
                runOnUiThread {
                    webView.evaluateJavascript(js, null)
                }
            }

            fun validateGithubAssetUrl(raw: String): URL {
                val url = URL(raw)
                val uri = url.toURI()
                val host = (uri.host ?: "").lowercase(java.util.Locale.US)
                val allowedHost = host == "github.com" ||
                    host == "api.github.com" ||
                    host == "objects.githubusercontent.com" ||
                    host == "release-assets.githubusercontent.com"
                if (uri.scheme != "https" || uri.rawUserInfo != null ||
                    (uri.port != -1 && uri.port != 443) || !allowedHost
                ) {
                    throw SecurityException("更新下載網址不是受信任的 GitHub HTTPS 資產網址")
                }
                return url
            }

            fun certificateFingerprint(signature: android.content.pm.Signature): String {
                return java.security.MessageDigest.getInstance("SHA-256")
                    .digest(signature.toByteArray())
                    .joinToString("") { byte ->
                        "%02X".format(java.util.Locale.US, byte.toInt() and 0xff)
                    }
            }

            @Suppress("DEPRECATION")
            fun signerMatchesInstalledApp(apkPath: String): Boolean {
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    PackageManager.GET_SIGNING_CERTIFICATES
                } else {
                    PackageManager.GET_SIGNATURES
                }
                val archiveInfo = packageManager.getPackageArchiveInfo(apkPath, flags) ?: return false
                if (archiveInfo.packageName != packageName) return false
                val installedInfo = packageManager.getPackageInfo(packageName, flags)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val installedSigning = installedInfo.signingInfo ?: return false
                    val archiveSigning = archiveInfo.signingInfo ?: return false
                    val installedCurrent = installedSigning.apkContentsSigners
                        ?.map(::certificateFingerprint)?.toSet().orEmpty()
                    val archiveCurrent = archiveSigning.apkContentsSigners
                        ?.map(::certificateFingerprint)?.toSet().orEmpty()
                    if (installedCurrent.isEmpty() || archiveCurrent.isEmpty()) return false

                    if (installedSigning.hasMultipleSigners() || archiveSigning.hasMultipleSigners()) {
                        return installedCurrent == archiveCurrent
                    }

                    val archiveHistory = archiveSigning.signingCertificateHistory
                        ?.map(::certificateFingerprint)?.toSet().orEmpty()
                    val compatibleHistory = if (archiveHistory.isNotEmpty()) archiveHistory else archiveCurrent
                    return compatibleHistory.containsAll(installedCurrent)
                }

                val installedSigners = installedInfo.signatures
                    ?.map(::certificateFingerprint)?.toSet().orEmpty()
                val archiveSigners = archiveInfo.signatures
                    ?.map(::certificateFingerprint)?.toSet().orEmpty()
                return installedSigners.isNotEmpty() && installedSigners == archiveSigners
            }

            thread {
                try {
                    emitProgress("downloading", 0, 0L, 0L)
                    val updatesDir = File(filesDir, "updates").apply { mkdirs() }
                    val outFile = File(updatesDir, safeName)
                    val tempFile = File(updatesDir, "$safeName.part")
                    partialFile = tempFile
                    if (tempFile.exists()) tempFile.delete()

                    var currentUrl = apkUrl
                    var redirects = 0
                    while (redirects < 6) {
                        val urlObj = validateGithubAssetUrl(currentUrl)
                        val connection = (urlObj.openConnection() as HttpsURLConnection).apply {
                            instanceFollowRedirects = false
                            connectTimeout = 20000
                            readTimeout = 30000
                            setRequestProperty("User-Agent", "DroidPy-Updater/1.0")
                            setRequestProperty("Accept", "application/vnd.android.package-archive")
                        }
                        activeConnection = connection
                        val code = connection.responseCode
                        if (code in 300..399) {
                            val location = connection.getHeaderField("Location")
                            connection.disconnect()
                            activeConnection = null
                            if (location.isNullOrBlank()) break
                            currentUrl = URL(urlObj, location).toString()
                            redirects++
                            continue
                        }
                        if (code !in 200..299) {
                            connection.disconnect()
                            activeConnection = null
                            tempFile.delete()
                            emitProgress("error", 0, message = "下載更新失敗 (HTTP $code)")
                            return@thread
                        }
                        break
                    }

                    val connection = activeConnection
                    if (connection == null || connection.responseCode !in 200..299) {
                        connection?.disconnect()
                        activeConnection = null
                        tempFile.delete()
                        emitProgress("error", 0, message = "下載更新失敗：重新導向次數過多或網址無效")
                        return@thread
                    }

                    val totalBytes = connection.contentLengthLong
                    if (totalBytes > maxApkBytes) {
                        connection.disconnect()
                        activeConnection = null
                        tempFile.delete()
                        emitProgress("error", 0, message = "更新 APK 超過 300 MiB 安全上限")
                        return@thread
                    }

                    var downloaded = 0L
                    var lastEmit = 0L
                    connection.inputStream.use { input ->
                        java.io.FileOutputStream(tempFile).use { output ->
                            val buffer = ByteArray(16384)
                            while (true) {
                                val count = input.read(buffer)
                                if (count < 0) break
                                if (count == 0) continue
                                downloaded += count.toLong()
                                if (downloaded > maxApkBytes) {
                                    throw SecurityException("更新 APK 超過 300 MiB 安全上限")
                                }
                                if (totalBytes > 0L && downloaded > totalBytes) {
                                    throw SecurityException("更新 APK 長度與伺服器宣告不符")
                                }
                                output.write(buffer, 0, count)
                                val now = SystemClock.elapsedRealtime()
                                if (now - lastEmit >= 180L) {
                                    lastEmit = now
                                    val percent = if (totalBytes > 0L) {
                                        ((downloaded * 100L) / totalBytes).toInt().coerceIn(0, 99)
                                    } else -1
                                    emitProgress("downloading", percent, downloaded, totalBytes)
                                }
                            }
                            output.flush()
                            output.fd.sync()
                        }
                    }
                    connection.disconnect()
                    activeConnection = null

                    if (downloaded <= 0L || (totalBytes > 0L && downloaded != totalBytes)) {
                        tempFile.delete()
                        emitProgress("error", 0, downloaded, totalBytes, "更新 APK 下載不完整，已拒絕安裝")
                        return@thread
                    }

                    if (!signerMatchesInstalledApp(tempFile.absolutePath)) {
                        tempFile.delete()
                        emitProgress(
                            "error",
                            0,
                            downloaded,
                            totalBytes,
                            "更新 APK 驗證失敗：應用程式識別或簽名與目前安裝版本不相容，已拒絕安裝"
                        )
                        return@thread
                    }

                    // Keep the previous verified download until the new APK has passed identity/signature checks.
                    val previousFile = File(updatesDir, "$safeName.previous")
                    if (previousFile.exists()) previousFile.delete()
                    val hadPrevious = outFile.exists()
                    if (hadPrevious && !outFile.renameTo(previousFile)) {
                        tempFile.delete()
                        throw IllegalStateException("無法安全保留上一份更新 APK")
                    }
                    if (!tempFile.renameTo(outFile)) {
                        if (hadPrevious) previousFile.renameTo(outFile)
                        tempFile.delete()
                        throw IllegalStateException("無法安全保存已驗證的更新 APK")
                    }
                    if (hadPrevious) previousFile.delete()
                    partialFile = null

                    emitProgress("installing", 100, downloaded, if (totalBytes > 0L) totalBytes else downloaded)

                    runOnUiThread {
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
                                Toast.makeText(this@MainActivity, "請允許 DroidPy 安裝未知來源應用程式以完成更新", Toast.LENGTH_LONG).show()
                                val permIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                                    data = Uri.parse("package:\\$packageName")
                                }
                                startActivity(permIntent)
                                return@runOnUiThread
                            }
                            val contentUri = FileProvider.getUriForFile(
                                this@MainActivity,
                                "\${packageName}.fileprovider",
                                outFile
                            )
                            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(contentUri, "application/vnd.android.package-archive")
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(installIntent)
                        } catch (e: Exception) {
                            emitProgress("error", 0, message = "啟動系統安裝器失敗: \${e.message}")
                        }
                    }
                } catch (e: Exception) {
                    try { activeConnection?.disconnect() } catch (_: Exception) {}
                    try { partialFile?.delete() } catch (_: Exception) {}
                    emitProgress("error", 0, message = "更新下載錯誤: \${e.message}")
                }
            }
        }

        @JavascriptInterface
        fun readPersistedState(): String {
            try {
                val f = File(filesDir, "droidpy_ide_state.json")
                if (f.exists()) {
                    val txt = f.readText(Charsets.UTF_8)
                    if (txt.isNotBlank()) return txt
                }
            } catch (_: Exception) {
            }
            if (hasStoragePermission()) {
                try {
                    val backup = File(Environment.getExternalStorageDirectory(), "DroidPy/.droidpy_backup/droidpy_ide_state.json")
                    if (backup.exists() && backup.length() > 2L) {
                        val txt = backup.readText(Charsets.UTF_8)
                        if (txt.isNotBlank()) {
                            File(filesDir, "droidpy_ide_state.json").writeText(txt, Charsets.UTF_8)
                            return txt
                        }
                    }
                } catch (_: Exception) {
                }
            }
            return ""
        }

        @JavascriptInterface
        fun writePersistedState(json: String) {
            stateIoExecutor.execute {
                try {
                    val target = File(filesDir, "droidpy_ide_state.json")
                    val tmp = File(filesDir, "droidpy_ide_state.json.tmp")
                    tmp.writeText(json, Charsets.UTF_8)
                    if (!tmp.renameTo(target)) {
                        target.writeText(json, Charsets.UTF_8)
                        tmp.delete()
                    }
                } catch (_: Exception) {
                }
                if (hasStoragePermission()) {
                    try {
                        // The shared-storage recovery copy must not contain the per-install bridge credential.
                        // Fail closed: never copy an unparseable state (which may still contain a bridge token)
                        // into shared storage. The previous valid recovery snapshot remains untouched.
                        val backupJson = JSONObject(json).apply {
                            optJSONObject("termuxConfig")?.put("token", "")
                        }.toString()
                        val backupDir = File(Environment.getExternalStorageDirectory(), "DroidPy/.droidpy_backup").apply { mkdirs() }
                        val backup = File(backupDir, "droidpy_ide_state.json")
                        val backupTmp = File(backupDir, "droidpy_ide_state.json.tmp")
                        backupTmp.writeText(backupJson, Charsets.UTF_8)
                        if (!backupTmp.renameTo(backup)) {
                            backup.writeText(backupJson, Charsets.UTF_8)
                            backupTmp.delete()
                        }
                    } catch (_: Exception) {
                    }
                }
            }
        }

        @JavascriptInterface
        fun getInternalStoragePath(): String = Environment.getExternalStorageDirectory().absolutePath

        @JavascriptInterface
        fun hasStoragePermission(): Boolean {
            val manageOk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Environment.isExternalStorageManager()
            } else {
                true
            }
            val writeOk = ContextCompat.checkSelfPermission(
                this@MainActivity,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                manageOk
            } else {
                writeOk
            }
        }

        @JavascriptInterface
        fun requestStoragePermission() {
            runOnUiThread {
                requestExternalStoragePermissionIfNeeded(force = true)
            }
        }

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
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        // File URLs may load the exact bundled entry document, but must not gain
        // cross-file or universal access to private app data.
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.isLongClickable = true
        webView.isHapticFeedbackEnabled = true
        webView.setOnLongClickListener { false }

        webView.addJavascriptInterface(NativeDownloadBridge(), "DroidPyNative")
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                if (request != null && !request.isForMainFrame) {
                    // The privileged JavaScript interface must never be exposed to child frames.
                    return true
                }
                val uri = request?.url ?: return false
                if (isTrustedAppNavigation(uri)) {
                    return false
                }
                // Never render an untrusted page in the WebView that owns the
                // privileged DroidPyNative JavaScript interface.
                return try {
                    if (uri.scheme.equals("https", ignoreCase = true) ||
                        uri.scheme.equals("http", ignoreCase = true)
                    ) {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                    }
                    true
                } catch (_: Exception) {
                    true
                }
            }
        }
        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            val fileName = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType)
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                val qUrl = JSONObject.quote(url)
                val qName = JSONObject.quote(fileName)
                val js = """
                    (function() {
                      fetch($qUrl).then(r => r.blob()).then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = function() {
                          window.DroidPyNative.saveBase64File(reader.result, $qName, blob.type || 'application/octet-stream');
                        };
                        reader.readAsDataURL(blob);
                      }).catch(() => {});
                    })();
                """.trimIndent()
                webView.evaluateJavascript(js, null)
            } else {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (_: Exception) {
                }
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
                    return
                }
                webView.evaluateJavascript(
                    "(function(){ return window.__droidpyHandleBack ? Boolean(window.__droidpyHandleBack()) : false; })()"
                ) { handled ->
                    if (handled == "true") return@evaluateJavascript
                    if (webView.canGoBack()) {
                        webView.goBack()
                        return@evaluateJavascript
                    }
                    val now = SystemClock.elapsedRealtime()
                    if (now - lastBackPressedAt <= 2000L) {
                        exitToast?.cancel()
                        try {
                            CookieManager.getInstance().flush()
                        } catch (_: Exception) {
                        }
                        var finished = false
                        val finishNow = {
                            if (!finished) {
                                finished = true
                                finish()
                            }
                        }
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(finishNow, 180L)
                        try {
                            webView.evaluateJavascript("window.dispatchEvent(new Event('droidpy-flush-state'));") {
                                finishNow()
                            }
                        } catch (_: Exception) {
                            finishNow()
                        }
                    } else {
                        lastBackPressedAt = now
                        exitToast?.cancel()
                        exitToast = Toast.makeText(
                            this@MainActivity,
                            "再按一次返回鍵退出 ${safeKotlinTitle}",
                            Toast.LENGTH_SHORT
                        ).also { it.show() }
                    }
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
        val remoteUrl = "${typeof window !== 'undefined' ? window.location.origin : 'https://localhost'}"
        val bridgeAllowedOrigin = when {
            hasBundledWww -> normalizedOrigin(Uri.parse("http://127.0.0.1:8765/")) ?: "http://127.0.0.1:8765"
            localWeb.exists() -> "null"
            else -> normalizedOrigin(Uri.parse(remoteUrl)) ?: "null"
        }

        thread {
            val usrDir = File(filesDir, "usr")
            val workspaceDir = File(filesDir, "droidpy_workspace").apply { mkdirs() }
            val homeDir = workspaceDir.parentFile!!
            seedDefaultWorkspaceFiles(workspaceDir)

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager()) {
                try {
                    File(Environment.getExternalStorageDirectory(), "Download/tmp").mkdirs()
                    File(Environment.getExternalStorageDirectory(), "DroidPy/.droidpy_backup").mkdirs()
                } catch (_: Exception) {
                }
            }

            fun cleanupOrphanedFilesOnStartup() {
                try {
                    File(filesDir, "usr_tmp").takeIf { it.exists() }?.deleteRecursively()
                    File(usrDir, "tmp_pkg_stage").takeIf { it.exists() }?.deleteRecursively()
                    File(usrDir, "var/cache/apt/archives").listFiles()?.forEach { f ->
                        if (f.isFile && f.name.endsWith(".deb")) f.delete()
                        else if (f.isDirectory && f.name == "partial") f.listFiles()?.forEach { it.deleteRecursively() }
                    }
                    File(homeDir, "tmp").listFiles()?.forEach { f ->
                        if (f.name.startsWith("pip-") || f.name.startsWith("pip_build_") || f.name == "pip-cache") {
                            f.deleteRecursively()
                        }
                    }
                    File(homeDir, ".cache/pip").takeIf { it.exists() }?.deleteRecursively()
                    val updatesDir = File(filesDir, "updates")
                    if (updatesDir.isDirectory) {
                        val apks = updatesDir.listFiles()?.filter { it.isFile && it.name.endsWith(".apk") }
                            ?.sortedByDescending { it.lastModified() } ?: emptyList()
                        apks.drop(1).forEach { it.delete() }
                    }
                    val lf = File(filesDir, "droidpy_native.log")
                    if (lf.isFile && lf.length() > 220 * 1024L) {
                        val kept = lf.readLines(Charsets.UTF_8).takeLast(400)
                        lf.writeText(kept.joinToString("\\n") + "\\n", Charsets.UTF_8)
                    }
                } catch (_: Exception) {
                }
            }

            cleanupOrphanedFilesOnStartup()

            val bootstrapMarker = File(usrDir, ".droidpy_bootstrap_ok")
            val hasExistingInstall = bootstrapMarker.exists() ||
                File(usrDir, "var/lib/dpkg/status").exists() ||
                File(usrDir, "bin/apt-get").exists() ||
                File(usrDir, "bin/python").exists() ||
                File(usrDir, "bin/python3").exists() ||
                File(usrDir, "bin/dash").exists() ||
                File(usrDir, "bin/bash").exists()
            // A damaged install can lose every sentinel while still containing user packages.
            // Treat unreadable/non-directory usr paths conservatively as existing data too.
            val hasExistingUsrData = usrDir.exists() && (
                !usrDir.isDirectory || usrDir.listFiles()?.isNotEmpty() != false
            )

            fun appendStartupLog(tag: String, msg: String) {
                try {
                    val lf = File(filesDir, "droidpy_native.log")
                    val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
                    lf.appendText("[$ts] [$tag] $msg\\n")
                } catch (_: Exception) {
                }
            }

            appendStartupLog("MainActivity", "onCreate startup: hasExistingInstall=$hasExistingInstall")

            if (!hasExistingInstall && !hasExistingUsrData) {
                try {
                    appendStartupLog("Bootstrap", "Extracting bootstrap-aarch64.zip into \${usrDir.absolutePath}")
                    extractTermuxBootstrap(usrDir)
                    appendStartupLog("Bootstrap", "Bootstrap extraction completed successfully")
                } catch (e: Exception) {
                    appendStartupLog("Bootstrap", "Bootstrap extraction FAILED: \${e.message}")
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "Bootstrap 解壓失敗: \${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            } else {
                try {
                    repairTermuxRuntime(usrDir)
                    if (hasExistingInstall && !bootstrapMarker.exists()) {
                        bootstrapMarker.writeText("1")
                    }
                    if (hasExistingInstall) {
                        appendStartupLog("Bootstrap", "Preserved existing usr/ environment and repaired runtime symlinks")
                    } else {
                        appendStartupLog("Bootstrap", "Detected partial usr/ data without core markers; preserved it and skipped destructive bootstrap re-extraction")
                        runOnUiThread {
                            Toast.makeText(this@MainActivity, "偵測到既有 Termux 資料但核心檔案不完整，已先保留套件資料，未自動重置。", Toast.LENGTH_LONG).show()
                        }
                    }
                } catch (e: Exception) {
                    appendStartupLog("Bootstrap", "repairTermuxRuntime warning: \${e.message}")
                }
            }

            localBridge = EmbeddedTermuxBridge(
                appContext = applicationContext,
                usrDir = usrDir,
                workspaceDir = workspaceDir,
                token = bridgeToken,
                allowedOrigin = bridgeAllowedOrigin,
                assetManager = assets
            ).also { it.start() }

            runOnUiThread {
                if (hasBundledWww) {
                    trustedAppOrigin = normalizedOrigin(Uri.parse("http://127.0.0.1:8765/"))
                    trustedLocalWebPath = null
                    webView.loadUrl("http://127.0.0.1:8765/")
                } else if (localWeb.exists()) {
                    trustedAppOrigin = null
                    trustedLocalWebPath = localWeb.canonicalPath
                    webView.loadUrl("file://" + localWeb.absolutePath)
                } else {
                    trustedAppOrigin = normalizedOrigin(Uri.parse(remoteUrl))
                    trustedLocalWebPath = null
                    webView.loadUrl(remoteUrl)
                }
            }
        }
    }

    private fun requestExternalStoragePermissionIfNeeded(force: Boolean = false) {
        val permsToAsk = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            listOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_AUDIO
            ).forEach { perm ->
                if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                    permsToAsk.add(perm)
                }
            }
        } else {
            listOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ).forEach { perm ->
                if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                    permsToAsk.add(perm)
                }
            }
        }
        if (permsToAsk.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permsToAsk.toTypedArray(), 1001)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:\$packageName")
                }
                startActivity(intent)
            } catch (_: Exception) {
                try {
                    startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun extractTermuxBootstrap(usrDir: File) {
        val tempDir = File(filesDir, "usr_tmp").apply {
            deleteRecursively()
            mkdirs()
        }
        val tempCanonical = tempDir.canonicalPath
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
                        if (!outFile.canonicalPath.startsWith(tempCanonical)) {
                            zis.closeEntry()
                            entry = zis.nextEntry
                            continue
                        }
                        if (entry.isDirectory) {
                            outFile.mkdirs()
                        } else {
                            outFile.parentFile?.mkdirs()
                            outFile.outputStream().use { zis.copyTo(it) }
                            if (entry.name.startsWith("bin/") || entry.name.startsWith("libexec/") || entry.name.startsWith("lib/")) {
                                outFile.setExecutable(true, false)
                            }
                        }
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
                symlinks.forEach { (target, linkPath) ->
                    try {
                        val fixedTarget = when {
                            target.startsWith("/data/data/com.termux/files/usr/") ->
                                usrDir.absolutePath + target.removePrefix("/data/data/com.termux/files/usr")
                            target == "/data/data/com.termux/files/usr" ->
                                usrDir.absolutePath
                            else -> target
                        }
                        val link = File(tempDir, linkPath)
                        link.parentFile?.mkdirs()
                        android.system.Os.symlink(fixedTarget, link.absolutePath)
                    } catch (_: Exception) {
                    }
                }
            }
        }
        if (usrDir.exists()) {
            usrDir.deleteRecursively()
        }
        if (!tempDir.renameTo(usrDir)) {
            tempDir.copyRecursively(usrDir, overwrite = true)
            tempDir.deleteRecursively()
        }
        repairTermuxRuntime(usrDir)
        try {
            File(usrDir, ".droidpy_bootstrap_ok").writeText("1")
        } catch (_: Exception) {
        }
    }

    private fun repairTermuxRuntime(usrDir: File) {
        val binDir = File(usrDir, "bin").apply { mkdirs() }
        val shFile = File(binDir, "sh")
        if (!shFile.exists()) {
            val shTarget = listOf("dash", "bash", "mksh", "busybox")
                .map { File(binDir, it) }
                .firstOrNull { it.exists() }
            if (shTarget != null) {
                try {
                    if (shFile.exists() || java.nio.file.Files.isSymbolicLink(shFile.toPath())) {
                        shFile.delete()
                    }
                    android.system.Os.symlink(shTarget.name, shFile.absolutePath)
                } catch (_: Exception) {
                }
            }
        }
        val legacyPrefix = "/data/data/com.termux/files/usr"
        fun healSymlinksRecursive(dir: File, depth: Int) {
            if (depth > 5 || !dir.isDirectory) return
            dir.listFiles()?.forEach { f ->
                try {
                    val p = f.toPath()
                    if (java.nio.file.Files.isSymbolicLink(p)) {
                        val target = android.system.Os.readlink(f.absolutePath)
                        if (target.startsWith("\$legacyPrefix/")) {
                            val fixed = usrDir.absolutePath + target.removePrefix(legacyPrefix)
                            f.delete()
                            android.system.Os.symlink(fixed, f.absolutePath)
                        } else if (target == legacyPrefix) {
                            f.delete()
                            android.system.Os.symlink(usrDir.absolutePath, f.absolutePath)
                        }
                    } else if (f.isDirectory) {
                        healSymlinksRecursive(f, depth + 1)
                    }
                } catch (_: Exception) {
                }
            }
        }
        listOf(
            binDir,
            File(usrDir, "etc"),
            File(usrDir, "lib"),
            File(usrDir, "libexec"),
            File(usrDir, "share")
        ).forEach { healSymlinksRecursive(it, 0) }
        val libDir = File(usrDir, "lib")
        val prefix = usrDir.absolutePath
        libDir.listFiles()?.filter { it.isDirectory && it.name.startsWith("python3.") }?.forEach { pyLib ->
            pyLib.listFiles()?.forEach { f ->
                try {
                    if (f.isFile && f.name.startsWith("_sysconfigdata") && f.name.endsWith(".py")) {
                        val txt = f.readText(Charsets.UTF_8)
                        if (txt.contains(legacyPrefix)) {
                            f.writeText(txt.replace(legacyPrefix, prefix), Charsets.UTF_8)
                        }
                    } else if (f.isDirectory && f.name.startsWith("config-")) {
                        val mk = File(f, "Makefile")
                        if (mk.isFile) {
                            val txt = mk.readText(Charsets.UTF_8)
                            if (txt.contains(legacyPrefix)) {
                                mk.writeText(txt.replace(legacyPrefix, prefix), Charsets.UTF_8)
                            }
                        }
                    }
                } catch (_: Exception) {
                }
            }
        }
        File(libDir, "pkgconfig").listFiles()?.forEach { pc ->
            if (pc.isFile && pc.name.endsWith(".pc")) {
                try {
                    val txt = pc.readText(Charsets.UTF_8)
                    if (txt.contains(legacyPrefix)) {
                        pc.writeText(txt.replace(legacyPrefix, prefix), Charsets.UTF_8)
                    }
                } catch (_: Exception) {
                }
            }
        }
        val pyCand = binDir.listFiles()?.firstOrNull {
            it.name.startsWith("python3.") && !it.name.endsWith("-config") && it.isFile
        }
        if (pyCand != null) {
            pyCand.setExecutable(true, false)
            val py3 = File(binDir, "python3")
            if (!py3.exists()) {
                try {
                    if (java.nio.file.Files.isSymbolicLink(py3.toPath())) py3.delete()
                    android.system.Os.symlink(pyCand.name, py3.absolutePath)
                } catch (_: Exception) {
                }
            }
            val py = File(binDir, "python")
            if (!py.exists()) {
                try {
                    if (java.nio.file.Files.isSymbolicLink(py.toPath())) py.delete()
                    android.system.Os.symlink("python3", py.absolutePath)
                } catch (_: Exception) {
                }
            }
        }
        // Normalize directory & cert bundle permissions inside usrDir to prevent Errno 13 Permission denied
        fun fixReadableTree(dir: File, depth: Int) {
            if (depth > 8 || !dir.isDirectory) return
            dir.setReadable(true, false)
            dir.setExecutable(true, false)
            dir.listFiles()?.forEach { child ->
                try {
                    if (java.nio.file.Files.isSymbolicLink(child.toPath())) return@forEach
                    if (child.isDirectory) {
                        fixReadableTree(child, depth + 1)
                    } else {
                        child.setReadable(true, false)
                    }
                } catch (_: Exception) {
                }
            }
        }
        listOf(
            File(usrDir, "etc"),
            File(usrDir, "tmp"),
            File(usrDir, "share/ca-certificates")
        ).forEach { fixReadableTree(it, 0) }
        libDir.listFiles()?.filter { it.isDirectory && it.name.startsWith("python3.") }?.forEach { pyLib ->
            pyLib.setReadable(true, false)
            pyLib.setExecutable(true, false)
            listOf(File(pyLib, "site-packages/certifi"), File(pyLib, "site-packages/pip/_vendor/certifi")).forEach { certDir ->
                fixReadableTree(certDir, 0)
            }
        }
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

    override fun onPause() {
        try {
            CookieManager.getInstance().flush()
            webView.evaluateJavascript("window.dispatchEvent(new Event('droidpy-flush-state'));", null)
        } catch (_: Exception) {
        }
        super.onPause()
    }

    @Suppress("DEPRECATION")
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= TRIM_MEMORY_MODERATE) {
            runOnUiThread {
                try {
                    webView.clearCache(false)
                } catch (_: Exception) {
                }
            }
        }
    }

    override fun onDestroy() {
        localBridge?.stop()
        try {
            stateIoExecutor.shutdown()
        } catch (_: Exception) {
        }
        super.onDestroy()
    }
}
`
  );

  // 5. EmbeddedTermuxBridge.kt — runs inside the APK on 127.0.0.1:8765 using the embedded usr/bin/sh & python
  zip.file(
    `android/app/src/main/java/${pkgPath}/EmbeddedTermuxBridge.kt`,
    `package ${safePkg}

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.AssetManager
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Toast
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.IDN
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URI
import java.net.URL
import java.net.URLDecoder
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SNIHostName
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

class EmbeddedTermuxBridge(
    private val appContext: Context,
    private val usrDir: File,
    private val workspaceDir: File,
    private val token: String,
    private val allowedOrigin: String,
    private val port: Int = 8765,
    private val assetManager: AssetManager? = null
) {
    private var serverSocket: ServerSocket? = null
    private var executor: ThreadPoolExecutor? = null
    private val activeClientSockets = java.util.Collections.newSetFromMap(
        java.util.concurrent.ConcurrentHashMap<Socket, Boolean>()
    )
    @Volatile private var running = false
    @Volatile private var activeProcess: Process? = null
    private val activeProcessStartedAt = AtomicLong(0L)
    private val logLock = Any()
    private val nativeLogFile: File
        get() = File(appContext.filesDir, "droidpy_native.log")
    private val manifestFile: File
        get() = File(appContext.filesDir, "packages_manifest.json")

    private fun stripAnsiForLog(s: String): String {
        if (s.isEmpty()) return s
        val out = StringBuilder(s.length)
        var i = 0
        val n = s.length
        while (i < n) {
            val ch = s[i]
            if (ch == '\\u001B' || ch == '\\u009B') {
                if (ch == '\\u001B' && i + 1 < n) {
                    val nxt = s[i + 1]
                    if (nxt == '[') {
                        i += 2
                        while (i < n && !(s[i] in '@'..'~')) i++
                        if (i < n) i++
                        continue
                    } else if (nxt == ']' || nxt == 'P' || nxt == 'X' || nxt == '^' || nxt == '_') {
                        i += 2
                        while (i < n && s[i] != '\\u0007') {
                            if (s[i] == '\\u001B' && i + 1 < n && s[i + 1] == '\\\\') {
                                i += 2
                                break
                            }
                            i++
                        }
                        if (i < n && s[i] == '\\u0007') i++
                        continue
                    } else if (nxt == '(' || nxt == ')' || nxt == '#') {
                        i = (i + 3).coerceAtMost(n)
                        continue
                    } else if (nxt in ' '..'~') {
                        i += 2
                        continue
                    }
                    i++
                    continue
                } else if (ch == '\\u009B') {
                    i++
                    while (i < n && !(s[i] in '@'..'~')) i++
                    if (i < n) i++
                    continue
                }
            }
            if (ch == '\\r') {
                if (i + 1 < n && s[i + 1] == '\\n') {
                    out.append('\\n')
                    i += 2
                } else {
                    out.append('\\n')
                    i++
                }
                continue
            }
            if (ch == '\\uFFFD' || (ch.code in 0..8) || ch.code in 11..31 || ch.code in 127..159) {
                i++
                continue
            }
            out.append(ch)
            i++
        }
        return out.toString()
            .replace(Regex("\\\\[(?:[0-9]{0,3}(?:[;:][0-9]{0,3})*)?m{1,2}"), "")
            .replace(Regex("(?:^|(?<=[\\\\s\\\\]|:;]))(?:[34]?8[;:][25])?(?:[;:][0-9]{0,3})+m{1,2}"), "")
            .replace(Regex("^[0-9;:]{1,16}m{1,2}", RegexOption.MULTILINE), "")
    }

    private fun appendNativeLog(tag: String, msg: String) {
        try {
            val cleanMsg = stripAnsiForLog(msg)
            android.util.Log.i("DroidPy", "[$tag] $cleanMsg")
            val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
            val line = "[$ts] [$tag] $cleanMsg\\n"
            synchronized(logLock) {
                val f = nativeLogFile
                f.parentFile?.mkdirs()
                if (f.exists() && f.length() > 220 * 1024L) {
                    val lines = f.readLines(Charsets.UTF_8)
                    f.writeText(lines.takeLast((lines.size / 2).coerceAtLeast(100)).joinToString("\\n") + "\\n", Charsets.UTF_8)
                }
                f.appendText(line, Charsets.UTF_8)
            }
        } catch (_: Exception) {
        }
    }

    fun start() {
        if (running) return
        val localServer = ServerSocket().apply {
            reuseAddress = true
            bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), port), 16)
        }
        val localExecutor = ThreadPoolExecutor(
            1, 8, 60L, TimeUnit.SECONDS, ArrayBlockingQueue<Runnable>(16)
        )
        serverSocket = localServer
        executor = localExecutor
        running = true
        appendNativeLog("Bridge", "EmbeddedTermuxBridge started on 127.0.0.1:$port (usr=\${usrDir.absolutePath})")
        Thread({
            while (running && serverSocket === localServer) {
                try {
                    val client = localServer.accept()
                    activeClientSockets.add(client)
                    try {
                        localExecutor.execute {
                            try {
                                handleClient(client)
                            } finally {
                                activeClientSockets.remove(client)
                            }
                        }
                    } catch (_: RejectedExecutionException) {
                        activeClientSockets.remove(client)
                        try {
                            client.getOutputStream().write(
                                "HTTP/1.1 503 Service Unavailable\\r\\nContent-Length: 0\\r\\nConnection: close\\r\\n\\r\\n".toByteArray(Charsets.US_ASCII)
                            )
                        } catch (_: Exception) {
                        }
                        try { client.close() } catch (_: Exception) {}
                        appendNativeLog("Bridge", "Rejected client: bounded request capacity reached")
                    }
                } catch (e: Exception) {
                    if (!running || serverSocket !== localServer) break
                    appendNativeLog("Bridge", "Accept loop error: \${e.message}")
                }
            }
        }, "DroidPyBridge-Accept").apply {
            isDaemon = true
            start()
        }
    }

    fun stop() {
        running = false
        appendNativeLog("Bridge", "EmbeddedTermuxBridge stopping")
        // Bridge shutdown must never terminate an active user Python process.
        // Only the explicit /stop action may terminate that process.
        val oldServer = serverSocket
        serverSocket = null
        try { oldServer?.close() } catch (_: Exception) {}
        activeClientSockets.toList().forEach { client ->
            try { client.close() } catch (_: Exception) {}
        }
        activeClientSockets.clear()
        val oldExecutor = executor
        executor = null
        try { oldExecutor?.shutdownNow() } catch (_: Exception) {}
    }

    private fun ensurePrefixWrappers(): File {
        val homeDir = workspaceDir.parentFile!!
        val wrapperDir = File(homeDir, ".droidpy_bin").apply { mkdirs() }
        val prefix = usrDir.absolutePath
        val legacyPrefix = "/data/data/com.termux/files/usr"

        // Heal symlinks first so etc/tls/cert.pem or etc/apt/trusted.gpg.d/* resolve properly
        val binDir = File(usrDir, "bin")
        fun healDirSymlinks(dir: File, depth: Int) {
            if (depth > 5 || !dir.isDirectory) return
            dir.listFiles()?.forEach { f ->
                try {
                    if (java.nio.file.Files.isSymbolicLink(f.toPath())) {
                        val target = android.system.Os.readlink(f.absolutePath)
                        if (target.startsWith("\$legacyPrefix/")) {
                            f.delete()
                            android.system.Os.symlink(prefix + target.removePrefix(legacyPrefix), f.absolutePath)
                        } else if (target == legacyPrefix) {
                            f.delete()
                            android.system.Os.symlink(prefix, f.absolutePath)
                        }
                    } else if (f.isDirectory) {
                        healDirSymlinks(f, depth + 1)
                    }
                } catch (_: Exception) {
                }
            }
        }
        listOf(
            binDir,
            File(usrDir, "etc"),
            File(usrDir, "lib"),
            File(usrDir, "libexec"),
            File(usrDir, "share")
        ).forEach { healDirSymlinks(it, 0) }

        val certFile = resolveCaBundleFile()
        val cert = certFile?.absolutePath ?: File(usrDir, "etc/tls/cert.pem").absolutePath

        // Ensure essential APT/dpkg directories exist cleanly inside app filesDir/usr
        listOf(
            "etc/apt/apt.conf.d",
            "etc/apt/sources.list.d",
            "etc/apt/preferences.d",
            "etc/apt/trusted.gpg.d",
            "var/lib/apt/lists/partial",
            "var/cache/apt/archives/partial",
            "var/lib/dpkg/updates",
            "var/lib/dpkg/info",
            "var/log/apt"
        ).forEach { rel ->
            File(usrDir, rel).apply {
                mkdirs()
                setReadable(true, false)
                setExecutable(true, false)
            }
        }
        File(usrDir, "var/lib/dpkg/status").apply { if (!exists()) writeText("") }
        File(usrDir, "etc/apt/preferences").apply { if (!exists()) writeText("") }

        // Unconditionally write full APT config so libapt-pkg redirects Dir/Dir::Etc/Dir::Etc::parts
        // BEFORE it ever tries reading compiled-in /data/data/com.termux/files/usr/etc/apt/apt.conf.d/
        val aptConfLines = mutableListOf(
            "Dir \\"$prefix/\\";",
            "Dir::State \\"$prefix/var/lib/apt\\";",
            "Dir::State::status \\"$prefix/var/lib/dpkg/status\\";",
            "Dir::Cache \\"$prefix/var/cache/apt\\";",
            "Dir::Etc \\"$prefix/etc/apt\\";",
            "Dir::Etc::parts \\"$prefix/etc/apt/apt.conf.d\\";",
            "Dir::Etc::main \\"$prefix/etc/apt/apt.conf\\";",
            "Dir::Etc::preferences \\"$prefix/etc/apt/preferences\\";",
            "Dir::Etc::preferencesparts \\"$prefix/etc/apt/preferences.d\\";",
            "Dir::Etc::sourcelist \\"$prefix/etc/apt/sources.list\\";",
            "Dir::Etc::sourceparts \\"$prefix/etc/apt/sources.list.d\\";",
            "Dir::Etc::Trusted \\"$prefix/etc/apt/trusted.gpg\\";",
            "Dir::Etc::TrustedParts \\"$prefix/etc/apt/trusted.gpg.d\\";",
            "Dir::Log \\"$prefix/var/log/apt\\";",
            "Dir::Bin::methods \\"$prefix/lib/apt/methods\\";",
            "Dir::Bin::dpkg \\"$prefix/bin/dpkg\\";",
            "Dir::Bin::apt-key \\"$prefix/bin/apt-key\\";",
            "Dir::Bin::gpg \\"$prefix/bin/gpgv\\";",
            "APT::Sandbox::User \\"root\\";",
        )
        if (certFile != null) {
            aptConfLines.add("Acquire::https::CaInfo \\"\${certFile.absolutePath}\\";")
        }
        val aptConfFile = File(usrDir, "etc/apt/apt.conf").apply {
            parentFile?.mkdirs()
            writeText(aptConfLines.joinToString("\\n") + "\\n")
        }

        // Rewrite legacy /data/data/com.termux/files/usr paths in apt.conf.d and bin/apt-key
        listOf(File(usrDir, "etc/apt/apt.conf.d"), File(usrDir, "bin/apt-key")).forEach { target ->
            val targets = if (target.isDirectory) target.listFiles()?.toList() ?: emptyList() else listOf(target)
            targets.forEach { cfg ->
                if (cfg.isFile && cfg.length() < 256 * 1024L) {
                    try {
                        val txt = cfg.readText()
                        if (txt.contains(legacyPrefix)) {
                            cfg.writeText(txt.replace(legacyPrefix, prefix))
                        }
                    } catch (_: Exception) {
                    }
                }
            }
        }

        // Preserve signed Termux repository metadata; never add trusted=yes while relocating legacy paths.
        // Strip the legacy trusted=yes option from configurations written by older DroidPy versions.
        val listFiles = mutableListOf<File>()
        val mainSources = File(usrDir, "etc/apt/sources.list")
        if (mainSources.isFile) listFiles.add(mainSources)
        File(usrDir, "etc/apt/sources.list.d").listFiles()?.filter { it.isFile }?.let { listFiles.addAll(it) }
        listFiles.forEach { cfg ->
            try {
                val orig = cfg.readText()
                val updated = orig.lines().joinToString("\\n") { line ->
                    var cur = line.replace(legacyPrefix, prefix)
                    cur = cur.replace("[trusted=yes] ", "").replace(" [trusted=yes]", "")
                    cur
                }
                if (updated != orig) cfg.writeText(updated)
            } catch (_: Exception) {
            }
        }
        val activeDebLines = listFiles.sumOf { f ->
            try {
                f.readLines().count { it.trimStart().startsWith("deb ") }
            } catch (_: Exception) {
                0
            }
        }
        if (activeDebLines == 0) {
            try {
                mainSources.parentFile?.mkdirs()
                mainSources.writeText("deb https://packages-cf.termux.dev/apt/termux-main/ stable main\\n")
            } catch (_: Exception) {
            }
        }

        val pyCand = binDir.listFiles()?.firstOrNull {
            it.name.startsWith("python3.") && !it.name.endsWith("-config") && it.isFile
        }
        if (pyCand != null) {
            pyCand.setExecutable(true, false)
            val py3 = File(binDir, "python3")
            if (!py3.exists()) {
                try {
                    if (java.nio.file.Files.isSymbolicLink(py3.toPath())) py3.delete()
                    android.system.Os.symlink(pyCand.name, py3.absolutePath)
                } catch (_: Exception) {}
            }
            val py = File(binDir, "python")
            if (!py.exists()) {
                try {
                    if (java.nio.file.Files.isSymbolicLink(py.toPath())) py.delete()
                    android.system.Os.symlink("python3", py.absolutePath)
                } catch (_: Exception) {}
            }
        }

        val d = '$'
        val caOpt = if (certFile != null) {
            "-o Acquire::https::CaInfo=\${certFile.absolutePath}"
        } else {
            ""
        }

        val pkgLines = listOf(
            "#!/system/bin/sh",
            "PREFIX=\\"$prefix\\"",
            "APT_CONFIG=\\"\${aptConfFile.absolutePath}\\"",
            "export PREFIX APT_CONFIG",
            "APT_OPTS=\\"-c \${d}APT_CONFIG -o Dir=\${d}PREFIX/ -o Dir::State=\${d}PREFIX/var/lib/apt -o Dir::State::status=\${d}PREFIX/var/lib/dpkg/status -o Dir::Cache=\${d}PREFIX/var/cache/apt -o Dir::Etc=\${d}PREFIX/etc/apt -o Dir::Etc::parts=\${d}PREFIX/etc/apt/apt.conf.d -o Dir::Etc::main=\${d}PREFIX/etc/apt/apt.conf -o Dir::Etc::preferences=\${d}PREFIX/etc/apt/preferences -o Dir::Etc::preferencesparts=\${d}PREFIX/etc/apt/preferences.d -o Dir::Etc::sourcelist=\${d}PREFIX/etc/apt/sources.list -o Dir::Etc::sourceparts=\${d}PREFIX/etc/apt/sources.list.d -o Dir::Etc::Trusted=\${d}PREFIX/etc/apt/trusted.gpg -o Dir::Etc::TrustedParts=\${d}PREFIX/etc/apt/trusted.gpg.d -o Dir::Log=\${d}PREFIX/var/log/apt -o Dir::Bin::methods=\${d}PREFIX/lib/apt/methods -o Dir::Bin::dpkg=\${d}PREFIX/bin/dpkg -o Dir::Bin::apt-key=\${d}PREFIX/bin/apt-key -o Dir::Bin::gpg=\${d}PREFIX/bin/gpgv -o DPkg::Options::=--admindir=\${d}PREFIX/var/lib/dpkg -o APT::Sandbox::User=root $caOpt\\"",
            "mkdir -p \\"\${d}PREFIX/var/lib/apt/lists/partial\\" \\"\${d}PREFIX/var/cache/apt/archives/partial\\" \\"\${d}PREFIX/var/lib/dpkg/updates\\" \\"\${d}PREFIX/var/lib/dpkg/info\\" \\"\${d}PREFIX/etc/apt/apt.conf.d\\" \\"\${d}PREFIX/etc/apt/preferences.d\\" \\"\${d}PREFIX/var/log/apt\\"",
            "touch \\"\${d}PREFIX/var/lib/dpkg/status\\" \\"\${d}PREFIX/etc/apt/apt.conf\\" \\"\${d}PREFIX/etc/apt/preferences\\"",
            "SUB=\\"\${d}1\\"",
            "[ -z \\"\${d}SUB\\" ] && exit 1",
            "shift",
            "fix_prefix_symlinks() {",
            "  if [ -x \\"\${d}PREFIX/bin/find\\" ]; then",
            "    \\"\${d}PREFIX/bin/find\\" \\"\${d}PREFIX/bin\\" \\"\${d}PREFIX/etc\\" \\"\${d}PREFIX/lib\\" \\"\${d}PREFIX/libexec\\" \\"\${d}PREFIX/share\\" -maxdepth 5 -type l 2>/dev/null | while IFS= read -r item; do",
            "      tgt=\\"\${d}(readlink \\"\${d}item\\" 2>/dev/null)\\"",
            "      case \\"\${d}tgt\\" in",
            "        /data/data/com.termux/files/usr/*)",
            "          ln -sf \\"\${d}PREFIX/\${d}{tgt#/data/data/com.termux/files/usr/}\\" \\"\${d}item\\" 2>/dev/null || true",
            "          ;;",
            "      esac",
            "    done",
            "  else",
            "    for linkdir in \\"\${d}PREFIX/bin\\" \\"\${d}PREFIX/etc/apt/trusted.gpg.d\\" \\"\${d}PREFIX/etc/tls\\" \\"\${d}PREFIX/lib\\"; do",
            "      [ -d \\"\${d}linkdir\\" ] || continue",
            "      for item in \\"\${d}linkdir\\"/*; do",
            "        [ -L \\"\${d}item\\" ] || continue",
            "        tgt=\\"\${d}(readlink \\"\${d}item\\" 2>/dev/null)\\"",
            "        case \\"\${d}tgt\\" in",
            "          /data/data/com.termux/files/usr/*)",
            "            ln -sf \\"\${d}PREFIX/\${d}{tgt#/data/data/com.termux/files/usr/}\\" \\"\${d}item\\" 2>/dev/null || true",
            "            ;;",
            "        esac",
            "      done",
            "    done",
            "  fi",
            "}",
            "rewrite_sysconfig_prefix() {",
            "  for sc in \\"\${d}PREFIX/lib/python3.\\"*/_sysconfigdata*.py \\"\${d}PREFIX/lib/python3.\\"*/config-*/Makefile \\"\${d}PREFIX/lib/pkgconfig/\\"*.pc; do",
            "    [ -f \\"\${d}sc\\" ] || continue",
            "    if grep -q \\"/data/data/com.termux/files/usr\\" \\"\${d}sc\\" 2>/dev/null; then",
            "      sed -i \\"s|/data/data/com.termux/files/usr|\${d}PREFIX|g\\" \\"\${d}sc\\" 2>/dev/null || true",
            "    fi",
            "  done",
            "}",
            "ensure_python_links() {",
            "  if [ ! -e \\"\${d}PREFIX/bin/python3\\" ]; then",
            "    for pycand in \\"\${d}PREFIX/bin/python3.\\"*; do",
            "      [ -f \\"\${d}pycand\\" ] || continue",
            "      case \\"\${d}pycand\\" in *-config) continue ;; esac",
            "      chmod 755 \\"\${d}pycand\\" 2>/dev/null || true",
            "      ln -sf \\"\${d}(basename \\"\${d}pycand\\")\\" \\"\${d}PREFIX/bin/python3\\" 2>/dev/null || true",
            "      break",
            "    done",
            "  fi",
            "  if [ -e \\"\${d}PREFIX/bin/python3\\" ] && [ ! -e \\"\${d}PREFIX/bin/python\\" ]; then",
            "    ln -sf python3 \\"\${d}PREFIX/bin/python\\" 2>/dev/null || true",
            "  fi",
            "}",
            "record_dpkg_status() {",
            "  deb_file=\\"\${d}1\\"",
            "  CTRL=\\"\${d}(\\"\${d}PREFIX/bin/dpkg-deb\\" -f \\"\${d}deb_file\\" 2>/dev/null)\\"",
            "  PKG_NAME=\\"\${d}(printf '%s\\\\n' \\"\${d}CTRL\\" | sed -n 's/^Package: *//p' | head -n1)\\"",
            "  [ -z \\"\${d}PKG_NAME\\" ] && return 0",
            "  if ! grep -Fxq \\"Package: \${d}PKG_NAME\\" \\"\${d}PREFIX/var/lib/dpkg/status\\" 2>/dev/null; then",
            "    printf '%s\\\\nStatus: install ok installed\\\\n\\\\n' \\"\${d}CTRL\\" >> \\"\${d}PREFIX/var/lib/dpkg/status\\"",
            "  fi",
            "}",
            "relocate_debs() {",
            "  STAGE=\\"\${d}PREFIX/tmp_pkg_stage\\"",
            "  for deb in \\"\${d}PREFIX/var/cache/apt/archives/\\"*.deb; do",
            "    [ -f \\"\${d}deb\\" ] || continue",
            "    echo \\"[DroidPy pkg] 解壓安裝 \${d}(basename \\"\${d}deb\\")...\\"",
            "    rm -rf \\"\${d}STAGE\\" && mkdir -p \\"\${d}STAGE\\"",
            "    if ! \\"\${d}PREFIX/bin/dpkg-deb\\" -x \\"\${d}deb\\" \\"\${d}STAGE\\"; then",
            "      echo \\"[DroidPy pkg] 警告: 無法解壓 \${d}(basename \\"\${d}deb\\")\\"",
            "      continue",
            "    fi",
            "    if [ -d \\"\${d}STAGE/data/data/com.termux/files/usr\\" ]; then",
            "      if [ -x \\"\${d}PREFIX/bin/tar\\" ]; then",
            "        \\"\${d}PREFIX/bin/tar\\" -C \\"\${d}STAGE/data/data/com.termux/files/usr\\" -cf - . | \\"\${d}PREFIX/bin/tar\\" -C \\"\${d}PREFIX\\" -xpf - --no-same-owner --overwrite || \\"\${d}PREFIX/bin/cp\\" -af \\"\${d}STAGE/data/data/com.termux/files/usr/.\\" \\"\${d}PREFIX/\\"",
            "      else",
            "        \\"\${d}PREFIX/bin/cp\\" -af \\"\${d}STAGE/data/data/com.termux/files/usr/.\\" \\"\${d}PREFIX/\\" 2>/dev/null || cp -rf \\"\${d}STAGE/data/data/com.termux/files/usr/.\\" \\"\${d}PREFIX/\\"",
            "      fi",
            "    fi",
            "    record_dpkg_status \\"\${d}deb\\"",
            "    rm -f \\"\${d}deb\\"",
            "  done",
            "  rm -rf \\"\${d}STAGE\\"",
            "  chmod -R u+rwX,go+rX \\"\${d}PREFIX/etc\\" \\"\${d}PREFIX/lib\\" \\"\${d}PREFIX/share\\" \\"\${d}PREFIX/include\\" 2>/dev/null || true",
            "  chmod -R 755 \\"\${d}PREFIX/libexec\\" \\"\${d}PREFIX/lib/llvm-\\"*\\"/bin\\" \\"\${d}PREFIX/aarch64-linux-android/bin\\" 2>/dev/null || true",
            "  fix_prefix_symlinks",
            "  for f in \\"\${d}PREFIX/bin/\\"*; do",
            "    [ -f \\"\${d}f\\" ] || continue",
            "    chmod 755 \\"\${d}f\\" 2>/dev/null || true",
            "    if head -c 120 \\"\${d}f\\" 2>/dev/null | grep -q \\"#!/data/data/com.termux/files/usr/bin/\\"; then",
            "      sed -i \\"1s|^#!/data/data/com.termux/files/usr/bin/|#!\${d}PREFIX/bin/|\\" \\"\${d}f\\" 2>/dev/null || true",
            "    fi",
            "  done",
            "  rewrite_sysconfig_prefix",
            "  ensure_python_links",
            "  echo \\"[DroidPy pkg] 套件配置完成。\\"",
            "  return 0",
            "}",
            "fix_prefix_symlinks",
            "rewrite_sysconfig_prefix",
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
            "  uninstall|remove|purge)",
            "    \\"\${d}PREFIX/bin/apt-get\\" \${d}APT_OPTS remove -y \\"\${d}@\\" 2>/dev/null || true",
            "    ST=\\"\${d}PREFIX/var/lib/dpkg/status\\"",
            "    for rpkg in \\"\${d}@\\"; do",
            "      case \\"\${d}rpkg\\" in -*) continue ;; esac",
            "      [ -z \\"\${d}rpkg\\" ] && continue",
            "      if [ -f \\"\${d}ST\\" ]; then",
            "        TMP_ST=\\"\${d}ST.tmp\\"",
            "        BLK_ST=\\"\${d}ST.blk\\"",
            "        : > \\"\${d}TMP_ST\\"",
            "        : > \\"\${d}BLK_ST\\"",
            "        SKIP_BLK=0",
            "        while IFS= read -r line || [ -n \\"\${d}line\\" ]; do",
            "          if [ -z \\"\${d}line\\" ]; then",
            "            if [ \\"\${d}SKIP_BLK\\" -eq 0 ] && [ -s \\"\${d}BLK_ST\\" ]; then",
            "              cat \\"\${d}BLK_ST\\" >> \\"\${d}TMP_ST\\"",
            "              printf '\\\\n' >> \\"\${d}TMP_ST\\"",
            "            fi",
            "            SKIP_BLK=0",
            "            : > \\"\${d}BLK_ST\\"",
            "            continue",
            "          fi",
            "          case \\"\${d}line\\" in",
            "            \\"Package: \${d}rpkg\\") SKIP_BLK=1 ;;",
            "          esac",
            "          printf '%s\\\\n' \\"\${d}line\\" >> \\"\${d}BLK_ST\\"",
            "        done < \\"\${d}ST\\"",
            "        if [ \\"\${d}SKIP_BLK\\" -eq 0 ] && [ -s \\"\${d}BLK_ST\\" ]; then",
            "          cat \\"\${d}BLK_ST\\" >> \\"\${d}TMP_ST\\"",
            "          printf '\\\\n' >> \\"\${d}TMP_ST\\"",
            "        fi",
            "        rm -f \\"\${d}BLK_ST\\"",
            "        mv -f \\"\${d}TMP_ST\\" \\"\${d}ST\\"",
            "      fi",
            "      case \\"\${d}rpkg\\" in",
            "        apt|dpkg|bash|dash|sh|coreutils|busybox|python|python3|python-pip|termux-tools) ;;",
            "        *) rm -f \\"\${d}PREFIX/bin/\${d}rpkg\\" 2>/dev/null || true ;;",
            "      esac",
            "    done",
            "    echo \\"[DroidPy pkg] 套件已移除。\\"",
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
        // Remove PEP 668 EXTERNALLY-MANAGED markers so pip never refuses or splits user installs
        File(usrDir, "lib").listFiles()?.filter { it.isDirectory && it.name.startsWith("python3.") }?.forEach { pyLib ->
            try {
                val em = File(pyLib, "EXTERNALLY-MANAGED")
                if (em.exists()) em.delete()
            } catch (_: Exception) {
            }
        }

        val droidLibDir = File(homeDir, ".droidpy_lib").apply {
            mkdirs()
            setReadable(true, false)
            setExecutable(true, false)
        }
        val pipConfDir = File(homeDir, ".config/pip").apply { mkdirs() }
        val sysPipConf = File(usrDir, "etc/pip.conf")
        val userPipConf = File(pipConfDir, "pip.conf")
        val pyUserDir = File(homeDir, "py_user").apply {
            mkdirs()
            File(this, "bin").mkdirs()
            File(this, "lib").mkdirs()
            setReadable(true, false)
            setExecutable(true, false)
        }
        val pipConfBody = buildString {
            append("[global]\\n")
            append("no-cache-dir = true\\n")
            append("break-system-packages = true\\n")
            append("disable-pip-version-check = true\\n")
            if (certFile != null && certFile.exists() && certFile.length() > 0L) {
                append("cert = \${certFile.absolutePath}\\n")
            }
            append("\\n[install]\\n")
            append("user = true\\n")
        }
        listOf(sysPipConf, userPipConf).forEach { cfg ->
            try {
                cfg.parentFile?.mkdirs()
                cfg.writeText(pipConfBody, Charsets.UTF_8)
                cfg.setReadable(true, false)
            } catch (_: Exception) {
            }
        }

        // Write sitecustomize.py so BOTH pip wrapper and direct python -m pip calls:
        // 1) Resolve a verified readable PEM bundle (and cache text in RAM via cadata)
        // 2) Bypass pip's truststore SSL context (preventing truststore/_api.py Errno 13)
        // 3) Fallback ssl.SSLContext.load_verify_locations to in-memory cadata on PermissionError
        val siteCustomizePy = """
import base64
import importlib.abc
import os
import re
import shutil
import ssl
import sys

# Explicitly activate pip's configured user base so installed distributions remain importable.
try:
    import site
    _droidpy_user_base = os.environ.get("PYTHONUSERBASE")
    if _droidpy_user_base:
        _droidpy_user_site = site.getusersitepackages()
        if isinstance(_droidpy_user_site, (list, tuple)):
            _droidpy_user_sites = list(_droidpy_user_site)
        else:
            _droidpy_user_sites = [_droidpy_user_site]
        _droidpy_user_sites.append(os.path.join(
            _droidpy_user_base, "lib",
            "python%d.%d" % sys.version_info[:2], "site-packages"
        ))
        for _droidpy_site in _droidpy_user_sites:
            if _droidpy_site and os.path.isdir(_droidpy_site):
                site.addsitedir(_droidpy_site)
except Exception:
    pass

_DROIDPY_CA_FILE = None
_DROIDPY_CA_TEXT = None

def _droidpy_read_pem(path):
    if not path or not os.path.isfile(path):
        return None
    try:
        if os.path.getsize(path) <= 0:
            return None
        with open(path, "rb") as fp:
            raw = fp.read()
        txt = raw.decode("utf-8-sig", errors="ignore")
        blocks = re.findall(
            r"-----BEGIN CERTIFICATE-----([\\s\\S]*?)-----END CERTIFICATE-----",
            txt,
        )
        clean_blocks = []
        for body in blocks:
            payload = "".join(body.split())
            if not payload or not re.fullmatch(r"[A-Za-z0-9+/=]+", payload):
                continue
            try:
                der = base64.b64decode(payload, validate=True)
            except Exception:
                continue
            encoded = base64.b64encode(der).decode("ascii")
            wrapped = "\\n".join(encoded[i:i + 64] for i in range(0, len(encoded), 64))
            clean_blocks.append(
                "-----BEGIN CERTIFICATE-----\\n" + wrapped +
                "\\n-----END CERTIFICATE-----"
            )
        if clean_blocks:
            return "\\n".join(clean_blocks) + "\\n"
    except Exception:
        return None
    return None

def _droidpy_prepare_ca():
    global _DROIDPY_CA_FILE, _DROIDPY_CA_TEXT
    prefix = os.environ.get("PREFIX", "$prefix")
    home = os.environ.get("HOME", os.path.expanduser("~"))
    cands = [
        os.environ.get("SSL_CERT_FILE", ""),
        os.environ.get("PIP_CERT", ""),
        os.path.join(prefix, "tmp", "cacert.pem") if prefix else "",
        os.path.join(home, "tmp", "droidpy-cacert.pem") if home else "",
        os.path.join(prefix, "etc", "tls", "cert.pem") if prefix else "",
        os.path.join(prefix, "etc", "ssl", "cert.pem") if prefix else "",
        os.path.join(prefix, "etc", "ssl", "certs", "ca-certificates.crt") if prefix else "",
        os.path.join(prefix, "share", "ca-certificates", "cacert.pem") if prefix else "",
    ]
    for root in (prefix, os.path.join(home, ".local")):
        lib_dir = os.path.join(root, "lib") if root else ""
        if lib_dir and os.path.isdir(lib_dir):
            try:
                for entry in os.listdir(lib_dir):
                    if entry.startswith("python3."):
                        for sp in ("site-packages", "dist-packages"):
                            cands.append(os.path.join(lib_dir, entry, sp, "certifi", "cacert.pem"))
                            cands.append(os.path.join(lib_dir, entry, sp, "pip", "_vendor", "certifi", "cacert.pem"))
            except Exception:
                pass
    pem_text = None
    src_path = None
    for cand in cands:
        if not cand or cand in (src_path,):
            continue
        txt = _droidpy_read_pem(cand)
        if txt:
            pem_text = txt
            src_path = cand
            break
    if not pem_text:
        return None, None
    _DROIDPY_CA_TEXT = pem_text
    targets = []
    if prefix:
        targets.append(os.path.join(prefix, "tmp", "cacert.pem"))
    if home:
        targets.append(os.path.join(home, "tmp", "droidpy-cacert.pem"))
    chosen = src_path
    for dst in targets:
        try:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if os.path.abspath(dst) != os.path.abspath(src_path) or not _droidpy_read_pem(dst):
                with open(dst, "w", encoding="utf-8") as fp:
                    fp.write(pem_text)
            os.chmod(dst, 0o644)
            if _droidpy_read_pem(dst):
                chosen = dst
                break
        except Exception:
            continue
    _DROIDPY_CA_FILE = chosen
    if chosen:
        for k in ("SSL_CERT_FILE", "PIP_CERT", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"):
            os.environ[k] = chosen
    return chosen, pem_text

def _droidpy_patch_ssl():
    _orig_load = ssl.SSLContext.load_verify_locations
    def _safe_load_verify_locations(self, cafile=None, capath=None, cadata=None):
        try:
            return _orig_load(self, cafile=cafile, capath=capath, cadata=cadata)
        except (PermissionError, OSError):
            if cadata is not None:
                raise
            pem = None
            if cafile:
                pem = _droidpy_read_pem(cafile)
            if not pem:
                pem = _DROIDPY_CA_TEXT
            if pem:
                return _orig_load(self, cafile=None, capath=None, cadata=pem)
            if _DROIDPY_CA_FILE and _DROIDPY_CA_FILE != cafile:
                return _orig_load(self, cafile=_DROIDPY_CA_FILE, capath=None, cadata=None)
            raise
    ssl.SSLContext.load_verify_locations = _safe_load_verify_locations

def _droidpy_patch_module(name, mod):
    if mod is None:
        return
    if name in ("certifi", "pip._vendor.certifi") and _DROIDPY_CA_FILE:
        try:
            mod.where = lambda: _DROIDPY_CA_FILE
            if hasattr(mod, "core"):
                mod.core.where = lambda: _DROIDPY_CA_FILE
        except Exception:
            pass
    elif name == "pip._vendor.truststore._api":
        try:
            cls = getattr(mod, "SSLContext", None)
            if cls is not None and not getattr(cls, "_droidpy_patched", False):
                orig_ts_load = cls.load_verify_locations
                def _safe_ts_load(self, cafile=None, capath=None, cadata=None):
                    try:
                        return orig_ts_load(self, cafile=cafile, capath=capath, cadata=cadata)
                    except (PermissionError, OSError):
                        pem = _droidpy_read_pem(cafile) or _DROIDPY_CA_TEXT
                        if pem:
                            return orig_ts_load(self, cafile=None, capath=None, cadata=pem)
                        if _DROIDPY_CA_FILE and _DROIDPY_CA_FILE != cafile:
                            return orig_ts_load(self, cafile=_DROIDPY_CA_FILE, capath=None, cadata=None)
                        raise
                cls.load_verify_locations = _safe_ts_load
                cls._droidpy_patched = True
        except Exception:
            pass
    elif name == "pip._internal.cli.index_command":
        try:
            def _droidpy_create_ssl_context():
                pem = _DROIDPY_CA_TEXT
                if pem:
                    return ssl.create_default_context(cadata=pem)
                if _DROIDPY_CA_FILE:
                    return ssl.create_default_context(cafile=_DROIDPY_CA_FILE)
                return ssl.create_default_context()
            mod._create_truststore_ssl_context = _droidpy_create_ssl_context
        except Exception:
            pass

class _DroidPyHookLoader(importlib.abc.Loader):
    def __init__(self, orig_loader):
        self._orig_loader = orig_loader
        self._in_create = False
        self._in_exec = False

    def create_module(self, spec):
        loader = self._orig_loader
        if (
            loader is None
            or loader is self
            or isinstance(loader, _DroidPyHookLoader)
            or self._in_create
        ):
            return None
        fn = getattr(loader, "create_module", None)
        if fn is None:
            return None
        self._in_create = True
        try:
            return fn(spec)
        finally:
            self._in_create = False

    def exec_module(self, module):
        loader = self._orig_loader
        if (
            loader is not None
            and loader is not self
            and not isinstance(loader, _DroidPyHookLoader)
            and not self._in_exec
        ):
            self._in_exec = True
            try:
                if hasattr(loader, "exec_module"):
                    loader.exec_module(module)
                elif hasattr(loader, "load_module"):
                    loader.load_module(module.__name__)
            finally:
                self._in_exec = False
        _droidpy_patch_module(module.__name__, module)

    def __getattr__(self, name):
        return getattr(self._orig_loader, name)

class _DroidPySslImportHook(importlib.abc.MetaPathFinder):
    _TARGETS = frozenset({
        "certifi",
        "pip._vendor.certifi",
        "pip._vendor.truststore._api",
        "pip._internal.cli.index_command",
    })
    def __init__(self):
        self._in_progress = set()
    def find_spec(self, fullname, path, target=None):
        if fullname not in self._TARGETS or fullname in self._in_progress:
            return None
        self._in_progress.add(fullname)
        try:
            for finder in list(sys.meta_path):
                if isinstance(finder, _DroidPySslImportHook):
                    continue
                try:
                    spec = finder.find_spec(fullname, path, target)
                except Exception:
                    spec = None
                if spec is not None and spec.loader is not None:
                    orig_loader = spec.loader
                    if not isinstance(orig_loader, _DroidPyHookLoader) and not getattr(spec, "_droidpy_wrapped", False):
                        spec.loader = _DroidPyHookLoader(orig_loader)
                        try:
                            spec._droidpy_wrapped = True
                        except Exception:
                            pass
                    return spec
        finally:
            self._in_progress.discard(fullname)
        return None

_droidpy_prepare_ca()
_droidpy_patch_ssl()
for _mod_name in ("certifi", "pip._vendor.certifi", "pip._vendor.truststore._api", "pip._internal.cli.index_command"):
    if _mod_name in sys.modules:
        _droidpy_patch_module(_mod_name, sys.modules[_mod_name])
if not any(isinstance(f, _DroidPySslImportHook) for f in sys.meta_path):
    sys.meta_path.insert(0, _DroidPySslImportHook())
""".trimIndent() + "\\n"

        try {
            File(droidLibDir, "sitecustomize.py").apply {
                writeText(siteCustomizePy, Charsets.UTF_8)
                setReadable(true, false)
            }
        } catch (_: Exception) {
        }
        File(usrDir, "lib").listFiles()?.filter { it.isDirectory && it.name.startsWith("python3.") }?.forEach { pyLib ->
            try {
                val spDir = File(pyLib, "site-packages")
                if (spDir.isDirectory) {
                    File(spDir, "sitecustomize.py").apply {
                        writeText(siteCustomizePy, Charsets.UTF_8)
                        setReadable(true, false)
                    }
                }
            } catch (_: Exception) {
            }
        }

        val pipScript = listOf(
            "#!/system/bin/sh",
            "PY_BIN=\\"$prefix/bin/python\\"",
            "[ -x \\"\${d}PY_BIN\\" ] || PY_BIN=\\"$prefix/bin/python3\\"",
            "if [ ! -x \\"\${d}PY_BIN\\" ]; then",
            "  for c in \\"$prefix/bin/python3.\\"*; do",
            "    [ -f \\"\${d}c\\" ] || continue",
            "    case \\"\${d}c\\" in *-config) continue ;; esac",
            "    chmod 755 \\"\${d}c\\" 2>/dev/null || true",
            "    PY_BIN=\\"\${d}c\\"; break",
            "  done",
            "fi",
            "if ! \\"\${d}PY_BIN\\" -m pip --version >/dev/null 2>&1; then",
            "  \\"\${d}PY_BIN\\" -m ensurepip --upgrade >/dev/null 2>&1 || true",
            "fi",
            "rm -f \\"$prefix/lib/python3.\\"*/EXTERNALLY-MANAGED 2>/dev/null || true",
            "DROID_LIB=\\"\${droidLibDir.absolutePath}\\"",
            "case \\":\${d}PYTHONPATH:\\" in *\\":\${d}DROID_LIB:\\"*) ;; *) export PYTHONPATH=\\"\${d}DROID_LIB:\${d}PYTHONPATH\\" ;; esac",
            "export PIP_CONFIG_FILE=\\"\${sysPipConf.absolutePath}\\"",
            "CA_RAW=\\"\${d}(\\"\${d}PY_BIN\\" -c 'import certifi; print(certifi.where())' 2>/dev/null || true)\\"",
            "if [ -z \\"\${d}CA_RAW\\" ] || [ ! -s \\"\${d}CA_RAW\\" ]; then",
            "  CA_RAW=\\"\${d}(\\"\${d}PY_BIN\\" -c 'import pip._vendor.certifi as c; print(c.where())' 2>/dev/null || true)\\"",
            "fi",
            "if [ -z \\"\${d}CA_RAW\\" ] || [ ! -s \\"\${d}CA_RAW\\" ]; then",
            "  for cf in \\"$prefix/etc/tls/cert.pem\\" \\"$prefix/etc/ssl/cert.pem\\" \\"$prefix/etc/ssl/certs/ca-certificates.crt\\" \\"$prefix/share/ca-certificates/cacert.pem\\"; do",
            "    if [ -r \\"\${d}cf\\" ] && [ -s \\"\${d}cf\\" ]; then",
            "      CA_RAW=\\"\${d}cf\\"",
            "      break",
            "    fi",
            "  done",
            "fi",
            "CA_FOUND=\\"\\"",
            "if [ -n \\"\${d}CA_RAW\\" ] && [ -s \\"\${d}CA_RAW\\" ]; then",
            "  mkdir -p \\"$prefix/tmp\\" \\"\${d}HOME/tmp\\" 2>/dev/null || true",
            "  if cp -f \\"\${d}CA_RAW\\" \\"$prefix/tmp/cacert.pem\\" 2>/dev/null && chmod 644 \\"$prefix/tmp/cacert.pem\\" 2>/dev/null && [ -r \\"$prefix/tmp/cacert.pem\\" ]; then",
            "    CA_FOUND=\\"$prefix/tmp/cacert.pem\\"",
            "  elif cp -f \\"\${d}CA_RAW\\" \\"\${d}HOME/tmp/droidpy-cacert.pem\\" 2>/dev/null && chmod 644 \\"\${d}HOME/tmp/droidpy-cacert.pem\\" 2>/dev/null && [ -r \\"\${d}HOME/tmp/droidpy-cacert.pem\\" ]; then",
            "    CA_FOUND=\\"\${d}HOME/tmp/droidpy-cacert.pem\\"",
            "  elif [ -r \\"\${d}CA_RAW\\" ]; then",
            "    CA_FOUND=\\"\${d}CA_RAW\\"",
            "  fi",
            "fi",
            "if [ -n \\"\${d}CA_FOUND\\" ]; then",
            "  export PIP_CERT=\\"\${d}CA_FOUND\\" SSL_CERT_FILE=\\"\${d}CA_FOUND\\" REQUESTS_CA_BUNDLE=\\"\${d}CA_FOUND\\" CURL_CA_BUNDLE=\\"\${d}CA_FOUND\\"",
            "else",
            "  unset PIP_CERT SSL_CERT_FILE REQUESTS_CA_BUNDLE CURL_CA_BUNDLE",
            "fi",
            "if [ -d \\"$prefix/etc/tls/certs\\" ]; then export SSL_CERT_DIR=\\"$prefix/etc/tls/certs\\"; else export SSL_CERT_DIR=\\"\${d}HOME/tmp\\"; fi",
            "export PYTHONUSERBASE=\\"\${pyUserDir.absolutePath}\\"",
            "export PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_BREAK_SYSTEM_PACKAGES=1 PIP_NO_CACHE_DIR=1",
            "exec \\"\${d}PY_BIN\\" -m pip \\"\${d}@\\""
        ).joinToString("\\n") + "\\n"
        File(wrapperDir, "pip").apply {
            writeText(pipScript)
            setExecutable(true, false)
        }
        File(wrapperDir, "pip3").apply {
            writeText(pipScript)
            setExecutable(true, false)
        }

        // Override GNU make's hardcoded /data/data/com.termux/files/usr/bin/sh default SHELL
        val makeWrapper = listOf(
            "#!/system/bin/sh",
            "PREFIX=\\"$prefix\\"",
            "MAKE_SH=\\"\${d}PREFIX/bin/sh\\"",
            "[ -x \\"\${d}MAKE_SH\\" ] || MAKE_SH=\\"\${d}PREFIX/bin/dash\\"",
            "[ -x \\"\${d}MAKE_SH\\" ] || MAKE_SH=\\"\${d}PREFIX/bin/bash\\"",
            "[ -x \\"\${d}MAKE_SH\\" ] || MAKE_SH=/system/bin/sh",
            "MAKE_BIN=\\"\${d}PREFIX/bin/make\\"",
            "if [ ! -x \\"\${d}MAKE_BIN\\" ]; then",
            "  echo \\"make binary not found in \${d}PREFIX/bin\\" >&2",
            "  exit 127",
            "fi",
            "exec \\"\${d}MAKE_BIN\\" SHELL=\\"\${d}MAKE_SH\\" \\"\${d}@\\""
        ).joinToString("\\n") + "\\n"
        File(wrapperDir, "make").apply {
            writeText(makeWrapper)
            setExecutable(true, false)
        }

        // Write native droid.py bridge module for Embedded Termux Python scripts
        val sdcardPath = Environment.getExternalStorageDirectory().absolutePath
        val droidPy = """
import json
import os
import platform
import shutil
import urllib.request

_BRIDGE = "http://127.0.0.1:$port"
_TOKEN = "$token"

def _call(path, payload=None):
    data = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(
        _BRIDGE + path,
        data=data,
        headers={"Content-Type": "application/json", "X-DroidPy-Token": _TOKEN},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))

class _AwaitableDict(dict):
    def __await__(self):
        async def _coro():
            return self
        return _coro().__await__()

def vibrate(pattern=50):
    try:
        res = _call("/droid-action", {"action": "vibrate", "pattern": pattern})
        return bool(res.get("ok"))
    except Exception:
        return False

def toast(message):
    try:
        _call("/droid-action", {"action": "toast", "message": str(message)})
    except Exception:
        pass

def device_info():
    try:
        return _call("/droid-action", {"action": "device_info"})
    except Exception:
        return {
            "platform": f"Android ({platform.platform()})",
            "deviceType": "phone",
            "screen": "Native Android",
            "maxTouchPoints": 5,
            "online": True,
        }

def sdcard_path():
    return os.environ.get("SDCARD", "$sdcardPath")

def storage_info():
    root = sdcard_path()
    try:
        du = shutil.disk_usage(root)
        return _AwaitableDict({
            "root": root,
            "totalBytes": du.total,
            "usedBytes": du.used,
            "freeBytes": du.free,
            "usageBytes": du.used,
            "quotaBytes": du.total,
            "persisted": True,
        })
    except Exception:
        return _AwaitableDict({
            "root": root,
            "usageBytes": 0,
            "quotaBytes": 0,
            "persisted": False,
        })

def battery():
    return _AwaitableDict({"supported": False, "level": 1.0, "charging": True})

def clipboard_set(text):
    return False
""".trimIndent()
        File(droidLibDir, "droid.py").writeText(droidPy)

        // Ensure ./sdcard symlink inside workspace points to real internal storage
        try {
            val sdLink = File(workspaceDir, "sdcard")
            if (!sdLink.exists()) {
                android.system.Os.symlink(sdcardPath, sdLink.absolutePath)
            }
        } catch (_: Exception) {
        }

        return wrapperDir
    }

    private fun hasStorageAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun resolveSdcardTarget(relPath: String): File? {
        val root = Environment.getExternalStorageDirectory()
        val rootCanonical = root.canonicalPath
        val cleaned = relPath.trim().trimStart('/')
        val candidate = if (cleaned.isEmpty()) root else File(root, cleaned)
        val candCanonical = candidate.canonicalPath
        if (candCanonical != rootCanonical && !candCanonical.startsWith(rootCanonical + File.separator)) {
            return null
        }
        return candidate
    }

    private fun killProcessTree(proc: Process) {
        try {
            val pidField = proc.javaClass.getDeclaredField("pid").apply { isAccessible = true }
            val rootPid = (pidField.get(proc) as? Int) ?: -1
            if (rootPid > 0) {
                fun collectDescendants(parentPid: Int, out: MutableList<Int>) {
                    File("/proc").listFiles()?.forEach { entry ->
                        val childPid = entry.name.toIntOrNull() ?: return@forEach
                        try {
                            val stat = File(entry, "stat").readText()
                            val rp = stat.lastIndexOf(')')
                            if (rp > 0) {
                                val fields = stat.substring(rp + 2).split(' ')
                                val ppid = fields.getOrNull(1)?.toIntOrNull()
                                if (ppid == parentPid && childPid !in out) {
                                    collectDescendants(childPid, out)
                                    out.add(childPid)
                                }
                            }
                        } catch (_: Exception) {
                        }
                    }
                }
                val pids = mutableListOf<Int>()
                collectDescendants(rootPid, pids)
                pids.add(rootPid)
                pids.forEach { p ->
                    try { android.os.Process.killProcess(p) } catch (_: Exception) {}
                }
            }
        } catch (_: Exception) {
        }
        try { proc.inputStream.close() } catch (_: Exception) {}
        try { proc.errorStream.close() } catch (_: Exception) {}
        try { proc.outputStream.close() } catch (_: Exception) {}
        try { proc.destroyForcibly() } catch (_: Exception) {}
    }

    private fun resolveCaBundleFile(): File? {
        val homeDir = workspaceDir.parentFile!!
        val candidates = mutableListOf(
            File(usrDir, "etc/tls/cert.pem"),
            File(usrDir, "etc/ssl/cert.pem"),
            File(usrDir, "etc/ssl/certs/ca-certificates.crt"),
            File(usrDir, "share/ca-certificates/cacert.pem")
        )
        listOf(File(usrDir, "lib"), File(usrDir, "local/lib"), File(homeDir, ".local/lib")).forEach { libRoot ->
            libRoot.listFiles()?.filter { it.isDirectory && it.name.startsWith("python3.") }?.forEach { pyLib ->
                listOf("site-packages", "dist-packages").forEach { sp ->
                    candidates.add(0, File(pyLib, "$sp/certifi/cacert.pem"))
                    candidates.add(File(pyLib, "$sp/pip/_vendor/certifi/cacert.pem"))
                }
            }
        }
        val source = candidates.firstOrNull { f ->
            try {
                f.exists() && f.isFile && f.length() > 0L
            } catch (_: Exception) {
                false
            }
        } ?: return null

        val writableTargets = listOf(
            File(usrDir, "tmp/cacert.pem"),
            File(homeDir, "tmp/droidpy-cacert.pem")
        )
        for (dst in writableTargets) {
            try {
                dst.parentFile?.mkdirs()
                if (source.canonicalPath != dst.canonicalPath) {
                    source.copyTo(dst, overwrite = true)
                }
                dst.setReadable(true, false)
                if (dst.exists() && dst.canRead() && dst.length() > 0L) {
                    return dst
                }
            } catch (_: Exception) {
            }
        }
        return source
    }

    private fun cleanupStuckPythonProcesses(manual: Boolean): JSONObject {
        // Read-only diagnostics only. Elapsed time never authorizes process termination.
        val myPid = android.os.Process.myPid()
        var scannedCount = 0
        File("/proc").listFiles()?.forEach { entry ->
            val pid = entry.name.toIntOrNull() ?: return@forEach
            if (pid <= 1 || pid == myPid) return@forEach
            try {
                val cmdRaw = try {
                    File(entry, "cmdline").readBytes().toString(Charsets.UTF_8).replace('\\u0000', ' ').trim()
                } catch (_: Exception) {
                    ""
                }
                val comm = try { File(entry, "comm").readText(Charsets.UTF_8).trim() } catch (_: Exception) { "" }
                val lower = (cmdRaw + " " + comm).lowercase()
                if ((lower.contains("python") || lower.contains("pip")) && !lower.contains("droidpy_bridge")) {
                    scannedCount++
                }
            } catch (_: Exception) {
            }
        }
        return JSONObject()
            .put("ok", true)
            .put("checkedAt", System.currentTimeMillis())
            .put("manual", manual)
            .put("scannedCount", scannedCount)
            .put("killedCount", 0)
            .put("killed", JSONArray())
            .put("message", "Read-only process scan; no Python process is terminated based on age.")
    }

    private fun buildEnv(): Map<String, String> {
        val homeDir = workspaceDir.parentFile!!
        val wrapperBin = ensurePrefixWrappers().absolutePath
        val droidLib = File(homeDir, ".droidpy_lib").absolutePath
        val bin = File(usrDir, "bin").absolutePath
        val lib = File(usrDir, "lib").absolutePath
        val tmpDir = File(homeDir, "tmp").apply { mkdirs() }.absolutePath
        val pipCacheDir = File(homeDir, "tmp/pip-cache").apply { mkdirs() }.absolutePath
        val xdgCacheDir = File(homeDir, ".cache").apply { mkdirs() }.absolutePath
        val certFile = resolveCaBundleFile()
        val sdcard = Environment.getExternalStorageDirectory().absolutePath
        val certDir = File(usrDir, "etc/tls/certs")
        val shAbs = listOf(File(usrDir, "bin/sh"), File(usrDir, "bin/dash"), File(usrDir, "bin/bash"))
            .firstOrNull { it.exists() && it.canExecute() }?.absolutePath ?: "/system/bin/sh"
        val pyUserDir = File(homeDir, "py_user").apply {
            mkdirs()
            File(this, "bin").mkdirs()
            File(this, "lib").mkdirs()
        }
        val env = mutableMapOf(
            "PREFIX" to usrDir.absolutePath,
            "SHELL" to shAbs,
            "CONFIG_SHELL" to shAbs,
            "CMAKE_SH" to shAbs,
            "PYTHONHOME" to usrDir.absolutePath,
            "PYTHONUSERBASE" to pyUserDir.absolutePath,
            "PYTHONPATH" to "$droidLib:\${workspaceDir.absolutePath}",
            "HOME" to homeDir.absolutePath,
            "EXTERNAL_STORAGE" to sdcard,
            "SDCARD" to sdcard,
            "PATH" to "$wrapperBin:$bin:\${pyUserDir.absolutePath}/bin:/system/bin",
            "LD_LIBRARY_PATH" to lib,
            "TERMINFO" to File(usrDir, "share/terminfo").absolutePath,
            "TMPDIR" to tmpDir,
            "TMP" to tmpDir,
            "TEMP" to tmpDir,
            "XDG_CACHE_HOME" to xdgCacheDir,
            "PIP_CACHE_DIR" to pipCacheDir,
            "PIP_NO_CACHE_DIR" to "1",
            "PIP_BREAK_SYSTEM_PACKAGES" to "1",
            "PIP_DISABLE_PIP_VERSION_CHECK" to "1",
            "PIP_CONFIG_FILE" to File(usrDir, "etc/pip.conf").absolutePath,
            "DROIDPY_DISABLE_TRUSTSTORE" to "1",
            "SSL_CERT_DIR" to (if (certDir.isDirectory) certDir.absolutePath else tmpDir),
            "PYTHONUNBUFFERED" to "1",
            "PYTHONUTF8" to "1",
            "PYTHONIOENCODING" to "utf-8",
            "PYTHON_BASIC_REPL" to "1",
            "TERM" to "xterm-256color",
            "LANG" to "en_US.UTF-8",
            "LC_ALL" to "en_US.UTF-8",
            "APT_CONFIG" to File(usrDir, "etc/apt/apt.conf").absolutePath
        )
        val clangBin = listOf(File(usrDir, "bin/clang"), File(usrDir, "bin/aarch64-linux-android-clang")).firstOrNull { it.exists() }
        if (clangBin != null) {
            clangBin.setExecutable(true, false)
            val cxxBin = listOf(File(usrDir, "bin/clang++"), File(usrDir, "bin/aarch64-linux-android-clang++")).firstOrNull { it.exists() }
            val arBin = listOf(File(usrDir, "bin/llvm-ar"), File(usrDir, "bin/ar")).firstOrNull { it.exists() }
            val ranlibBin = listOf(File(usrDir, "bin/llvm-ranlib"), File(usrDir, "bin/ranlib")).firstOrNull { it.exists() }
            val prefixPath = usrDir.absolutePath
            env["CC"] = clangBin.absolutePath
            if (cxxBin != null) {
                cxxBin.setExecutable(true, false)
                env["CXX"] = cxxBin.absolutePath
            }
            env["LDSHARED"] = "\${clangBin.absolutePath} -shared"
            if (arBin != null) {
                arBin.setExecutable(true, false)
                env["AR"] = arBin.absolutePath
            }
            if (ranlibBin != null) {
                ranlibBin.setExecutable(true, false)
                env["RANLIB"] = ranlibBin.absolutePath
            }
            env["CPPFLAGS"] = "-I$prefixPath/include"
            env["LDFLAGS"] = "-L$prefixPath/lib -Wl,-rpath,$prefixPath/lib"
            env["PKG_CONFIG_PATH"] = "$prefixPath/lib/pkgconfig"
        }
        if (certFile != null) {
            val certPath = certFile.absolutePath
            env["SSL_CERT_FILE"] = certPath
            env["CURL_CA_BUNDLE"] = certPath
            env["REQUESTS_CA_BUNDLE"] = certPath
            env["PIP_CERT"] = certPath
        }
        env.putIfAbsent("ANDROID_ROOT", "/system")
        env.putIfAbsent("ANDROID_DATA", "/data")
        return env
    }

    private fun normalizePipPkgName(name: String): String {
        return name.trim().lowercase().replace(Regex("[-_.]+"), "-")
    }

    private data class PipInventory(val names: List<String>, val complete: Boolean)
    private data class PkgInventory(val names: List<String>, val complete: Boolean)

    private fun collectInstalledPipInventory(): PipInventory {
        val pipNames = mutableSetOf<String>()
        var metadataComplete = false
        val homeDir = workspaceDir.parentFile!!
        val libRoots = listOf(
            File(usrDir, "lib"),
            File(usrDir, "local/lib"),
            File(homeDir, "py_user/lib"),
            File(homeDir, ".local/lib")
        )
        try {
            libRoots.forEach { libRoot ->
                libRoot.listFiles()?.filter { it.isDirectory && it.name.startsWith("python3.") }?.forEach { pyLib ->
                    listOf(File(pyLib, "site-packages"), File(pyLib, "dist-packages"))
                        .filter { it.isDirectory }
                        .forEach { sp ->
                            sp.listFiles()?.filter { it.isDirectory }?.forEach { entry ->
                                val ename = entry.name
                                if (ename.startsWith("~")) return@forEach
                                var parsedName: String? = null
                                if (ename.endsWith(".dist-info")) {
                                    val meta = File(entry, "METADATA")
                                    if (meta.isFile) {
                                        try {
                                            meta.bufferedReader(Charsets.UTF_8).use { reader ->
                                                for (i in 0 until 25) {
                                                    val line = reader.readLine() ?: break
                                                    if (line.startsWith("Name:", ignoreCase = true)) {
                                                        parsedName = line.substringAfter(":").trim()
                                                        break
                                                    }
                                                }
                                            }
                                        } catch (_: Exception) {
                                        }
                                    }
                                    if (parsedName.isNullOrBlank()) {
                                        val base = ename.removeSuffix(".dist-info")
                                        parsedName = base.replace(Regex("-[0-9].*$"), "")
                                    }
                                } else if (ename.endsWith(".egg-info")) {
                                    val pkgInfo = File(entry, "PKG-INFO")
                                    if (pkgInfo.isFile) {
                                        try {
                                            pkgInfo.bufferedReader(Charsets.UTF_8).use { reader ->
                                                for (i in 0 until 25) {
                                                    val line = reader.readLine() ?: break
                                                    if (line.startsWith("Name:", ignoreCase = true)) {
                                                        parsedName = line.substringAfter(":").trim()
                                                        break
                                                    }
                                                }
                                            }
                                        } catch (_: Exception) {
                                        }
                                    }
                                    if (parsedName.isNullOrBlank()) {
                                        val base = ename.removeSuffix(".egg-info")
                                        parsedName = base.replace(Regex("-[0-9].*$"), "")
                                    }
                                }
                                if (!parsedName.isNullOrBlank()) {
                                    pipNames.add(normalizePipPkgName(parsedName!!))
                                }
                            }
                        }
                }
            }
        } catch (_: Exception) {
        }

        // Always cross-check filesystem metadata with Python's own distribution
        // database. One visible package must never suppress PYTHONUSERBASE discovery.
        val binDir = File(usrDir, "bin")
        val pyExe = listOf(File(binDir, "python3"), File(binDir, "python")).firstOrNull { it.exists() }
            ?: binDir.listFiles()?.firstOrNull {
                it.name.startsWith("python3.") && !it.name.endsWith("-config") && it.isFile
            }
        if (pyExe != null) {
            var proc: Process? = null
            var inventoryFile: File? = null
            try {
                pyExe.setExecutable(true, false)
                val homeTmp = File(homeDir, "tmp").apply { mkdirs() }
                val outputFile = File.createTempFile("pip-inventory-", ".json", homeTmp)
                inventoryFile = outputFile
                val pb = ProcessBuilder(
                    pyExe.absolutePath,
                    "-c",
                    "import importlib.metadata, json; print('DROIDPY_PIP_INVENTORY:' + json.dumps(sorted({d.metadata.get('Name','') for d in importlib.metadata.distributions() if d.metadata.get('Name')})))"
                )
                pb.directory(workspaceDir)
                pb.redirectErrorStream(true)
                pb.redirectOutput(outputFile)
                pb.environment().putAll(buildEnv())
                proc = pb.start()
                val finished = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    proc.waitFor(8, java.util.concurrent.TimeUnit.SECONDS)
                } else {
                    proc.waitFor() == 0
                }
                if (!finished) {
                    proc.destroyForcibly()
                } else if (proc.exitValue() == 0 && outputFile.isFile &&
                    outputFile.length() in 1L..(1024L * 1024L)) {
                    val txt = outputFile.readText(Charsets.UTF_8)
                    val marker = "DROIDPY_PIP_INVENTORY:"
                    val idx = txt.indexOf(marker)
                    if (idx >= 0) {
                        val jsonStart = idx + marker.length
                        val jsonEnd = txt.indexOf('\\n', jsonStart).let { if (it < 0) txt.length else it }
                        val arr = JSONArray(txt.substring(jsonStart, jsonEnd).trim())
                        for (i in 0 until arr.length()) {
                            val raw = arr.optString(i, "").trim()
                            if (raw.isNotEmpty()) pipNames.add(normalizePipPkgName(raw))
                        }
                        metadataComplete = true
                    }
                }
            } catch (_: Exception) {
            } finally {
                try {
                    proc?.destroyForcibly()
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        proc?.waitFor(2, java.util.concurrent.TimeUnit.SECONDS)
                    }
                } catch (_: Exception) {}
                try { proc?.inputStream?.close() } catch (_: Exception) {}
                try { proc?.errorStream?.close() } catch (_: Exception) {}
                try { proc?.outputStream?.close() } catch (_: Exception) {}
                try { inventoryFile?.delete() } catch (_: Exception) {}
            }
        }
        return PipInventory(pipNames.sorted(), metadataComplete)
    }

    private fun collectInstalledPipNames(): List<String> = collectInstalledPipInventory().names

    private fun calcDirSize(target: File): Long {
        if (!target.exists()) return 0L
        if (target.isFile) return target.length()
        if (java.nio.file.Files.isSymbolicLink(target.toPath())) return 0L
        var total = 0L
        target.listFiles()?.forEach { child ->
            total += calcDirSize(child)
        }
        return total
    }

    private fun collectAppStorageUsage(): JSONObject {
        val homeDir = workspaceDir.parentFile!!
        val usrBytes = calcDirSize(usrDir)
        var tmpBytes = calcDirSize(File(appContext.filesDir, "usr_tmp")) + calcDirSize(File(usrDir, "tmp_pkg_stage"))
        File(homeDir, "tmp").listFiles()?.forEach { f ->
            if (f.name.startsWith("pip-") || f.name.startsWith("pip_build_") || f.name == "pip-cache") {
                tmpBytes += calcDirSize(f)
            }
        }
        val cacheBytes = calcDirSize(File(homeDir, ".cache")) + calcDirSize(File(usrDir, "var/cache/apt/archives"))
        val workspaceBytes = calcDirSize(workspaceDir)
        val logBytes = if (nativeLogFile.isFile) nativeLogFile.length() else 0L
        val apkUpdatesBytes = calcDirSize(File(appContext.filesDir, "updates"))
        val reclaimableBytes = tmpBytes + cacheBytes + apkUpdatesBytes
        return JSONObject()
            .put("ok", true)
            .put("usrBytes", usrBytes)
            .put("tmpBytes", tmpBytes)
            .put("cacheBytes", cacheBytes)
            .put("workspaceBytes", workspaceBytes)
            .put("logBytes", logBytes)
            .put("apkUpdatesBytes", apkUpdatesBytes)
            .put("reclaimableBytes", reclaimableBytes)
    }

    private fun pruneStaleCacheAndTemp(clearAptLists: Boolean = false): Long {
        val before = collectAppStorageUsage().optLong("reclaimableBytes", 0L)
        val homeDir = workspaceDir.parentFile!!
        try {
            File(appContext.filesDir, "usr_tmp").takeIf { it.exists() }?.deleteRecursively()
            File(usrDir, "tmp_pkg_stage").takeIf { it.exists() }?.deleteRecursively()
            File(homeDir, "tmp").listFiles()?.forEach { f ->
                if (f.name.startsWith("pip-") || f.name.startsWith("pip_build_") || f.name == "pip-cache") {
                    f.deleteRecursively()
                }
            }
            File(homeDir, ".cache/pip").takeIf { it.exists() }?.deleteRecursively()
            File(usrDir, "var/cache/apt/archives").listFiles()?.forEach { f ->
                if (f.isFile && f.name.endsWith(".deb")) f.delete()
                else if (f.isDirectory && f.name == "partial") f.listFiles()?.forEach { it.deleteRecursively() }
            }
            val updatesDir = File(appContext.filesDir, "updates")
            if (updatesDir.isDirectory) {
                val apks = updatesDir.listFiles()?.filter { it.isFile && it.name.endsWith(".apk") }
                    ?.sortedByDescending { it.lastModified() } ?: emptyList()
                val dropCount = if (clearAptLists) 0 else 1
                apks.drop(dropCount).forEach { it.delete() }
            }
            if (clearAptLists) {
                File(usrDir, "var/lib/apt/lists").listFiles()?.forEach { f ->
                    if (f.isFile) f.delete()
                    else if (f.isDirectory && f.name == "partial") f.listFiles()?.forEach { it.deleteRecursively() }
                }
            }
        } catch (_: Exception) {
        }
        val after = collectAppStorageUsage().optLong("reclaimableBytes", 0L)
        return (before - after).coerceAtLeast(0L)
    }

    private fun collectInstalledPkgInventory(): PkgInventory {
        val pkgSet = mutableSetOf<String>()
        val statusFile = File(usrDir, "var/lib/dpkg/status")
        if (!statusFile.isFile || !statusFile.canRead()) return PkgInventory(emptyList(), false)
        return try {
            statusFile.forEachLine { line ->
                if (line.startsWith("Package:")) {
                    val p = line.substringAfter("Package:").trim()
                    if (p.isNotBlank()) pkgSet.add(p)
                }
            }
            PkgInventory(pkgSet.sorted(), pkgSet.isNotEmpty())
        } catch (_: Exception) {
            PkgInventory(pkgSet.sorted(), false)
        }
    }

    private fun collectInstalledPkgNames(): List<String> = collectInstalledPkgInventory().names

    private val corePipSet = setOf("pip", "setuptools", "wheel", "ensurepip", "distlib", "packaging")
    private val aptDefaultPipSet = setOf("pip", "setuptools", "wheel", "ensurepip", "distlib", "packaging", "lxml")
    private val defaultUserPkgCandidates = setOf("python", "python-pip", "python-lxml", "libxml2", "libxslt", "clang", "ffmpeg", "git", "nodejs", "openssh")

    private fun savePackageBackupSnapshot(
        pipInventory: PipInventory = collectInstalledPipInventory(),
        pkgInventory: PkgInventory = collectInstalledPkgInventory(),
        forceShrink: Boolean = false
    ) {
        try {
            val pipNames = pipInventory.names
            val pkgNames = pkgInventory.names
            val canShrink = forceShrink && pipInventory.complete && pkgInventory.complete
            val currentUserPip = pipNames.filter { it !in corePipSet }
            val currentUserPkg = pkgNames.filter { it in defaultUserPkgCandidates }
            val existing = readBackupManifest()
            val prevPipList = mutableListOf<String>()
            val prevArrP = existing?.optJSONArray("pipPackages")
            if (prevArrP != null) {
                for (i in 0 until prevArrP.length()) {
                    val v = prevArrP.optString(i, "").trim()
                    if (v.isNotEmpty()) prevPipList.add(v)
                }
            }
            val prevPkgList = mutableListOf<String>()
            val prevArrK = existing?.optJSONArray("pkgPackages")
            if (prevArrK != null) {
                for (i in 0 until prevArrK.length()) {
                    val v = prevArrK.optString(i, "").trim()
                    if (v.isNotEmpty()) prevPkgList.add(v)
                }
            }
            // Prevent baseline APT-only packages (pip + lxml) from overwriting a richer backup snapshot
            val hasCustomNow = currentUserPip.any { it !in aptDefaultPipSet }
            val hadCustomBefore = prevPipList.any { it !in aptDefaultPipSet }
            if (!canShrink && !hasCustomNow && hadCustomBefore) {
                return
            }
            val mergedPip = if (canShrink) {
                currentUserPip
            } else {
                (prevPipList + currentUserPip).distinct().sorted()
            }
            val mergedPkg = if (canShrink) {
                currentUserPkg
            } else {
                (prevPkgList + currentUserPkg).distinct().sorted()
            }
            val manifest = JSONObject()
                .put("updatedAt", System.currentTimeMillis())
                .put("pipPackages", JSONArray(mergedPip))
                .put("pkgPackages", JSONArray(mergedPkg))
            val text = manifest.toString()
            manifestFile.writeText(text, Charsets.UTF_8)
            if (hasStorageAccess()) {
                val backupDir = File(Environment.getExternalStorageDirectory(), "DroidPy/.droidpy_backup").apply { mkdirs() }
                File(backupDir, "packages_manifest.json").writeText(text, Charsets.UTF_8)
            }
        } catch (_: Exception) {
        }
    }

    private fun readBackupManifest(): JSONObject? {
        val candidates = mutableListOf(manifestFile)
        if (hasStorageAccess()) {
            candidates.add(File(Environment.getExternalStorageDirectory(), "DroidPy/.droidpy_backup/packages_manifest.json"))
        }
        var best: JSONObject? = null
        var bestScore = -1
        for (f in candidates) {
            try {
                if (f.isFile && f.length() > 2L) {
                    val obj = JSONObject(f.readText(Charsets.UTF_8))
                    val score = (obj.optJSONArray("pipPackages")?.length() ?: 0) + (obj.optJSONArray("pkgPackages")?.length() ?: 0)
                    if (score > bestScore) {
                        best = obj
                        bestScore = score
                    }
                }
            } catch (_: Exception) {
            }
        }
        return best
    }

    private fun handleClient(socket: Socket) {
        socket.use { sock ->
            sock.soTimeout = 15000
            val bis = BufferedInputStream(sock.getInputStream())
            val headerBuf = ByteArrayOutputStream()
            var p3 = 0
            var p2 = 0
            var p1 = 0
            while (true) {
                val b = bis.read()
                if (b == -1) return
                headerBuf.write(b)
                if (p3 == 13 && p2 == 10 && p1 == 13 && b == 10) break
                p3 = p2
                p2 = p1
                p1 = b
                if (headerBuf.size() > 16 * 1024) {
                    try {
                        sock.getOutputStream().write(
                            "HTTP/1.1 431 Request Header Fields Too Large\\r\\nContent-Length: 0\\r\\nConnection: close\\r\\n\\r\\n".toByteArray(Charsets.US_ASCII)
                        )
                    } catch (_: Exception) {
                    }
                    return
                }
            }
            val headerLines = headerBuf.toString("ISO-8859-1").split("\\r\\n")
            val requestLine = headerLines.firstOrNull()?.trim() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return
            val method = parts[0]
            val rawTarget = parts[1]
            val path = rawTarget.substringBefore("?")
            val queryStr = rawTarget.substringAfter("?", "")

            val headers = mutableMapOf<String, String>()
            var duplicateContentLength = false
            for (hLine in headerLines.drop(1)) {
                if (hLine.isEmpty()) continue
                val idx = hLine.indexOf(':')
                if (idx > 0) {
                    val key = hLine.substring(0, idx).trim().lowercase()
                    if (key == "content-length" && headers.containsKey(key)) {
                        duplicateContentLength = true
                    }
                    headers[key] = hLine.substring(idx + 1).trim()
                }
            }

            val out = sock.getOutputStream()
            if (duplicateContentLength || headers.containsKey("transfer-encoding")) {
                writeJson(out, 400, JSONObject().put("error", "Ambiguous or unsupported request framing"))
                return
            }
            val requestHost = headers["host"]?.lowercase()
            if (requestHost != "127.0.0.1:$port" && requestHost != "localhost:$port") {
                writeJson(out, 403, JSONObject().put("error", "Untrusted Host"))
                return
            }
            val requestOrigin = headers["origin"]
            if (requestOrigin != null && requestOrigin != allowedOrigin) {
                writeJson(out, 403, JSONObject().put("error", "Untrusted Origin"))
                return
            }
            if (method == "OPTIONS") {
                val allowPrivateNetwork = headers["access-control-request-private-network"].equals("true", ignoreCase = true)
                writeHeaders(out, 204, "text/plain", 0, allowPrivateNetwork)
                return
            }

            val apiRoutes = setOf(
                "/health",
                "/logs",
                "/logs/clear",
                "/stdin",
                "/stop",
                "/shell",
                "/run-stream",
                "/install-stream",
                "/shell-stream",
                "/files",
                "/probe-url",
                "/droid-action",
                "/backup/status",
                "/backup/restore",
                "/storage/app-usage",
                "/storage/cleanup",
                "/maintenance/cleanup-processes",
                "/sdcard/status",
                "/sdcard/list",
                "/sdcard/read",
                "/sdcard/write",
                "/sdcard/mkdir",
                "/sdcard/delete"
            )
            if (method == "GET" && path !in apiRoutes && !path.startsWith("/sdcard/") && serveBundledWebAsset(out, path)) {
                return
            }

            if (headers["x-droidpy-token"] != token) {
                writeJson(out, 401, JSONObject().put("error", "Invalid token"))
                return
            }

            val rawLength = headers["content-length"] ?: "0"
            if (!rawLength.matches(Regex("[0-9]{1,10}"))) {
                writeJson(out, 400, JSONObject().put("error", "Invalid Content-Length"))
                return
            }
            val len = rawLength.toIntOrNull()
            if (len == null || len > 8 * 1024 * 1024) {
                writeJson(out, 413, JSONObject().put("error", "Request body exceeds the 8 MiB limit"))
                return
            }
            val bodyBytes = ByteArray(len)
            var readTotal = 0
            while (readTotal < len) {
                val r = bis.read(bodyBytes, readTotal, len - readTotal)
                if (r < 0) break
                readTotal += r
            }
            if (readTotal != len) {
                writeJson(out, 400, JSONObject().put("error", "Incomplete request body"))
                return
            }
            val bodyStr = if (readTotal > 0) String(bodyBytes, 0, readTotal, Charsets.UTF_8).trim() else ""
            val bodyJson = try {
                if (bodyStr.isBlank()) JSONObject() else JSONObject(bodyStr)
            } catch (_: Exception) {
                writeJson(out, 400, JSONObject().put("error", "Invalid JSON body"))
                return
            }

            when {
                method == "GET" && path == "/health" -> {
                    val binDir = File(usrDir, "bin")
                    val pyBin = listOf(File(binDir, "python"), File(binDir, "python3")).firstOrNull { it.exists() }
                        ?: binDir.listFiles()?.firstOrNull {
                            it.name.startsWith("python3.") && !it.name.endsWith("-config") && it.isFile
                        }
                    val hasPython = pyBin != null

                    val pipInventory = collectInstalledPipInventory()
                    val pipList = pipInventory.names
                    val pipArr = JSONArray(pipList)
                    val pkgInventory = collectInstalledPkgInventory()
                    val pkgList = pkgInventory.names
                    val pkgArr = JSONArray(pkgList)
                    if (hasPython && pipList.isNotEmpty()) {
                        savePackageBackupSnapshot(pipInventory, pkgInventory)
                    }

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
                        .put("installedPipPackages", pipArr)
                        .put("installedPkgPackages", pkgArr)
                    writeJson(out, 200, res)
                }

                method == "GET" && path == "/backup/status" -> {
                    val manifest = readBackupManifest()
                    val pipInventory = collectInstalledPipInventory()
                    val pkgInventory = collectInstalledPkgInventory()
                    val currentPips = pipInventory.names.toSet()
                    val currentPkgs = pkgInventory.names.toSet()
                    val backedPipList = mutableListOf<String>()
                    val backedPkgList = mutableListOf<String>()
                    if (manifest != null) {
                        val arrP = manifest.optJSONArray("pipPackages")
                        if (pipInventory.complete && arrP != null) {
                            for (i in 0 until arrP.length()) {
                                val v = arrP.optString(i, "").trim()
                                if (v.isNotEmpty()) backedPipList.add(v)
                            }
                        }
                        val arrK = manifest.optJSONArray("pkgPackages")
                        if (pkgInventory.complete && arrK != null) {
                            for (i in 0 until arrK.length()) {
                                val v = arrK.optString(i, "").trim()
                                if (v.isNotEmpty()) backedPkgList.add(v)
                            }
                        }
                    }
                    // Incomplete inventories must never be interpreted as every package being missing.
                    val missingPip = if (pipInventory.complete) backedPipList.filter { normalizePipPkgName(it) !in currentPips } else emptyList()
                    val missingPkg = if (pkgInventory.complete) backedPkgList.filter { it !in currentPkgs } else emptyList()
                    writeJson(
                        out,
                        200,
                        JSONObject()
                            .put("ok", true)
                            .put("hasBackup", manifest != null)
                            .put("updatedAt", manifest?.optLong("updatedAt", 0L) ?: 0L)
                            .put("pipPackages", JSONArray(backedPipList))
                            .put("pkgPackages", JSONArray(backedPkgList))
                            .put("missingPipPackages", JSONArray(missingPip))
                            .put("missingPkgPackages", JSONArray(missingPkg))
                            .put("pipInventoryComplete", pipInventory.complete)
                            .put("pkgInventoryComplete", pkgInventory.complete)
                    )
                }

                method == "POST" && path == "/backup/restore" -> {
                    val manifest = readBackupManifest()
                    if (manifest == null) {
                        writeJson(out, 404, JSONObject().put("error", "找不到套件備份清單"))
                    } else {
                        val pipInventory = collectInstalledPipInventory()
                        val pkgInventory = collectInstalledPkgInventory()
                        val currentPips = pipInventory.names.toSet()
                        val currentPkgs = pkgInventory.names.toSet()
                        val needPkgs = mutableListOf("python", "python-pip")
                        val arrK = manifest.optJSONArray("pkgPackages")
                        if (arrK != null) {
                            for (i in 0 until arrK.length()) {
                                val v = arrK.optString(i, "").trim()
                                if (v.isNotEmpty() && v !in currentPkgs && v !in needPkgs) {
                                    needPkgs.add(v)
                                }
                            }
                        }
                        val needPips = mutableListOf<String>()
                        val arrP = manifest.optJSONArray("pipPackages")
                        if (arrP != null) {
                            for (i in 0 until arrP.length()) {
                                val v = arrP.optString(i, "").trim()
                                if (v.isNotEmpty() && normalizePipPkgName(v) !in currentPips) {
                                    needPips.add(v)
                                }
                            }
                        }
                        val missingPkgsOnly = needPkgs.filter { it !in currentPkgs }
                        val steps = mutableListOf<String>()
                        if (missingPkgsOnly.isNotEmpty()) {
                            steps.add("(pkg update -y || true)")
                            steps.add("pkg install -y " + missingPkgsOnly.joinToString(" "))
                        }
                        if (!pipInventory.complete && arrP != null && arrP.length() > 0) {
                            // Python is not ready yet. Restore native packages first; retry pip restore after initialization.
                            steps.add("echo '[DroidPy] Python package inventory is incomplete; skipped pip restore safely. Initialize Python, then retry restore.'")
                        }
                        // Use the same embedded Termux interpreter for imports and pip installs.
                        val pythonCmd = File(usrDir, "bin/python3").absolutePath
                        if (pipInventory.complete) {
                            steps.add("test -x $pythonCmd || { echo '[DroidPy] Python is not ready; package restore aborted.' >&2; exit 127; }")
                            if (needsNumpy) {
                                // Use Termux's prebuilt native package and verify it with the script interpreter.
                                steps.add("pkg install -y python-numpy && $pythonCmd -c 'import numpy' && echo '[DroidPy] NumPy ready (Termux binary package).'")
                            }
                            if (remainingPips.isNotEmpty()) {
                                steps.add("$pythonCmd -m pip install --no-cache-dir " + remainingPips.joinToString(" "))
                            }
                        }
                        val restoreCmd = if (steps.isEmpty()) {
                            "echo '[DroidPy] 所有已備份套件均已存在，無需還原。'"
                        } else {
                            steps.joinToString(" && ")
                        }
                        streamShellCommand(out, restoreCmd)
                    }
                }

                method == "GET" && path == "/logs" -> {
                    val nativeLines = JSONArray()
                    try {
                        synchronized(logLock) {
                            val f = nativeLogFile
                            if (f.isFile) {
                                f.readLines(Charsets.UTF_8).takeLast(450).forEach { nativeLines.put(it) }
                            }
                        }
                    } catch (_: Exception) {
                    }
                    val logcatLines = JSONArray()
                    var logcatProc: Process? = null
                    try {
                        val pid = android.os.Process.myPid()
                        logcatProc = ProcessBuilder("logcat", "-d", "-t", "80", "--pid=$pid").redirectErrorStream(true).start()
                        val txt = logcatProc.inputStream.bufferedReader(Charsets.UTF_8).readText()
                        logcatProc.waitFor()
                        txt.lines().filter { it.isNotBlank() }.takeLast(80).forEach { logcatLines.put(stripAnsiForLog(it)) }
                    } catch (_: Exception) {
                    } finally {
                        try { logcatProc?.inputStream?.close() } catch (_: Exception) {}
                        try { logcatProc?.errorStream?.close() } catch (_: Exception) {}
                        try { logcatProc?.outputStream?.close() } catch (_: Exception) {}
                    }
                    writeJson(
                        out,
                        200,
                        JSONObject()
                            .put("ok", true)
                            .put("logPath", nativeLogFile.absolutePath)
                            .put("nativeLines", nativeLines)
                            .put("logcatLines", logcatLines)
                    )
                }

                method == "POST" && path == "/logs/clear" -> {
                    try {
                        synchronized(logLock) {
                            nativeLogFile.writeText("", Charsets.UTF_8)
                        }
                    } catch (_: Exception) {
                    }
                    appendNativeLog("Logs", "Native log cleared by user")
                    writeJson(out, 200, JSONObject().put("ok", true))
                }

                method == "POST" && path == "/stdin" -> {
                    val data = bodyJson.optString("data", "") + "\\n"
                    val proc = activeProcess
                    if (proc == null) {
                        writeJson(out, 409, JSONObject().put("error", "No active process"))
                    } else {
                        try {
                            proc.outputStream.write(data.toByteArray())
                            proc.outputStream.flush()
                            writeJson(out, 200, JSONObject().put("ok", true))
                        } catch (e: Exception) {
                            writeJson(out, 500, JSONObject().put("error", e.message ?: "Write failed"))
                        }
                    }
                }

                method == "POST" && path == "/stop" -> {
                    val proc = activeProcess
                    if (proc != null) {
                        appendNativeLog("Exec", "Force stopping active process tree")
                        killProcessTree(proc)
                    }
                    writeJson(out, 200, JSONObject().put("ok", true))
                }

                method == "POST" && path == "/droid-action" -> {
                    when (bodyJson.optString("action")) {
                        "toast" -> {
                            val msg = bodyJson.optString("message", "")
                            Handler(Looper.getMainLooper()).post {
                                Toast.makeText(appContext, msg, Toast.LENGTH_SHORT).show()
                            }
                            writeJson(out, 200, JSONObject().put("ok", true))
                        }
                        "vibrate" -> {
                            val ms = bodyJson.optLong("pattern", 45L).coerceIn(10L, 2000L)
                            try {
                                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                    (appContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                                } else {
                                    @Suppress("DEPRECATION")
                                    appContext.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                                }
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
                                } else {
                                    @Suppress("DEPRECATION")
                                    vibrator.vibrate(ms)
                                }
                                writeJson(out, 200, JSONObject().put("ok", true))
                            } catch (_: Exception) {
                                writeJson(out, 200, JSONObject().put("ok", false))
                            }
                        }
                        "device_info" -> {
                            val dm = appContext.resources.displayMetrics
                            writeJson(
                                out,
                                200,
                                JSONObject()
                                    .put("platform", "Android \${Build.VERSION.RELEASE} (\${Build.MODEL})")
                                    .put("deviceType", "phone")
                                    .put("screen", "\${dm.widthPixels}x\${dm.heightPixels}")
                                    .put("pixelRatio", dm.density.toDouble())
                                    .put("maxTouchPoints", 5)
                                    .put("online", true)
                            )
                        }
                        else -> writeJson(out, 400, JSONObject().put("error", "Unknown action"))
                    }
                }

                method == "GET" && path == "/sdcard/status" -> {
                    val root = Environment.getExternalStorageDirectory()
                    val manageAll = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager() else true
                    val runtimeWrite = ContextCompat.checkSelfPermission(appContext, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
                    val droidpyDir = File(root, "DroidPy").absolutePath
                    var totalBytes = 0L
                    var freeBytes = 0L
                    var usedBytes = 0L
                    try {
                        val st = StatFs(root.path)
                        totalBytes = st.totalBytes
                        freeBytes = st.availableBytes
                        usedBytes = (totalBytes - freeBytes).coerceAtLeast(0L)
                    } catch (_: Exception) {
                    }
                    writeJson(
                        out,
                        200,
                        JSONObject()
                            .put("granted", hasStorageAccess())
                            .put("manageAllFiles", manageAll)
                            .put("runtimeWrite", runtimeWrite)
                            .put("rootPath", root.absolutePath)
                            .put("droidpyDir", droidpyDir)
                            .put("totalBytes", totalBytes)
                            .put("freeBytes", freeBytes)
                            .put("usedBytes", usedBytes)
                    )
                }

                method == "GET" && path == "/sdcard/list" -> {
                    val relParam = queryStr.split("&")
                        .firstOrNull { it.startsWith("path=") }
                        ?.substringAfter("=")
                        ?.let { URLDecoder.decode(it, "UTF-8") } ?: ""
                    val dir = resolveSdcardTarget(relParam)
                    if (dir == null) {
                        writeJson(out, 400, JSONObject().put("error", "Invalid path"))
                    } else if (!hasStorageAccess() && !dir.canRead()) {
                        writeJson(out, 403, JSONObject().put("error", "尚未取得手機內部儲存空間存取權限"))
                    } else {
                        val rootCanonical = Environment.getExternalStorageDirectory().canonicalPath
                        val arr = JSONArray()
                        val children = dir.listFiles()?.sortedWith(compareBy<File>({ !it.isDirectory }, { it.name.lowercase() })) ?: emptyList()
                        for (child in children) {
                            if (child.name.startsWith(".")) continue
                            val childRel = child.canonicalPath.removePrefix(rootCanonical).trimStart('/')
                            arr.put(
                                JSONObject()
                                    .put("name", child.name)
                                    .put("relPath", childRel)
                                    .put("isDir", child.isDirectory)
                                    .put("size", if (child.isFile) child.length() else 0L)
                                    .put("updatedAt", child.lastModified())
                            )
                        }
                        val currentRel = dir.canonicalPath.removePrefix(rootCanonical).trimStart('/')
                        writeJson(
                            out,
                            200,
                            JSONObject()
                                .put("granted", hasStorageAccess())
                                .put("rootPath", rootCanonical)
                                .put("currentPath", currentRel)
                                .put("entries", arr)
                        )
                    }
                }

                method == "POST" && path == "/sdcard/read" -> {
                    val relPath = bodyJson.optString("path", "")
                    val target = resolveSdcardTarget(relPath)
                    if (target == null || !target.exists() || !target.isFile) {
                        writeJson(out, 404, JSONObject().put("error", "找不到目標檔案"))
                    } else if (target.length() > 512 * 1024) {
                        writeJson(out, 413, JSONObject().put("error", "檔案超過 512 KB 上限"))
                    } else {
                        try {
                            writeJson(
                                out,
                                200,
                                JSONObject()
                                    .put("name", target.name)
                                    .put("relPath", relPath)
                                    .put("content", target.readText(Charsets.UTF_8))
                            )
                        } catch (e: Exception) {
                            writeJson(out, 403, JSONObject().put("error", e.message ?: "讀取失敗"))
                        }
                    }
                }

                method == "POST" && path == "/sdcard/write" -> {
                    if (!hasStorageAccess()) {
                        writeJson(out, 403, JSONObject().put("error", "尚未授予內部儲存空間權限"))
                    } else {
                        try {
                            val batch = bodyJson.optJSONArray("files")
                            if (batch != null) {
                                val folderRel = bodyJson.optString("dir", "DroidPy").ifBlank { "DroidPy" }
                                val destDir = resolveSdcardTarget(folderRel)
                                if (destDir == null) {
                                    writeJson(out, 400, JSONObject().put("error", "Invalid folder"))
                                } else {
                                    destDir.mkdirs()
                                    var count = 0
                                    for (i in 0 until batch.length()) {
                                        val item = batch.getJSONObject(i)
                                        val name = File(item.optString("name", "")).name
                                        if (name.isNotBlank()) {
                                            File(destDir, name).writeText(item.optString("content", ""), Charsets.UTF_8)
                                            count++
                                        }
                                    }
                                    writeJson(out, 200, JSONObject().put("ok", true).put("count", count).put("dir", destDir.absolutePath))
                                }
                            } else {
                                val relPath = bodyJson.optString("path", "")
                                val target = resolveSdcardTarget(relPath)
                                if (target == null) {
                                    writeJson(out, 400, JSONObject().put("error", "Invalid path"))
                                } else {
                                    target.parentFile?.mkdirs()
                                    target.writeText(bodyJson.optString("content", ""), Charsets.UTF_8)
                                    writeJson(out, 200, JSONObject().put("ok", true).put("path", target.absolutePath))
                                }
                            }
                        } catch (e: Exception) {
                            writeJson(out, 403, JSONObject().put("error", e.message ?: "寫入失敗"))
                        }
                    }
                }

                method == "POST" && path == "/sdcard/mkdir" -> {
                    val relPath = bodyJson.optString("path", "")
                    val target = resolveSdcardTarget(relPath)
                    if (target == null) {
                        writeJson(out, 400, JSONObject().put("error", "Invalid path"))
                    } else if (!hasStorageAccess()) {
                        writeJson(out, 403, JSONObject().put("error", "尚未授予內部儲存空間權限"))
                    } else {
                        val created = target.exists() || target.mkdirs()
                        writeJson(out, if (created) 200 else 500, JSONObject().put("ok", created))
                    }
                }

                method == "POST" && path == "/sdcard/delete" -> {
                    val relPath = bodyJson.optString("path", "")
                    val rootCanonical = Environment.getExternalStorageDirectory().canonicalPath
                    val target = resolveSdcardTarget(relPath)
                    if (target == null || target.canonicalPath == rootCanonical) {
                        writeJson(out, 400, JSONObject().put("error", "Invalid path"))
                    } else if (!hasStorageAccess()) {
                        writeJson(out, 403, JSONObject().put("error", "尚未授予內部儲存空間權限"))
                    } else {
                        val deleted = if (target.isDirectory) target.deleteRecursively() else target.delete()
                        writeJson(out, if (deleted) 200 else 500, JSONObject().put("ok", deleted))
                    }
                }

                method == "GET" && path == "/storage/app-usage" -> {
                    writeJson(out, 200, collectAppStorageUsage())
                }

                method == "POST" && path == "/storage/cleanup" -> {
                    val freed = pruneStaleCacheAndTemp(clearAptLists = true)
                    appendNativeLog("Storage", "Cleaned stale temp/cache, freed=\${freed}B")
                    writeJson(
                        out,
                        200,
                        JSONObject()
                            .put("ok", true)
                            .put("freedBytes", freed)
                            .put("usageAfter", collectAppStorageUsage())
                    )
                }

                method == "POST" && path == "/maintenance/cleanup-processes" -> {
                    val manual = bodyJson.optBoolean("manual", true)
                    val res = cleanupStuckPythonProcesses(manual = manual)
                    appendNativeLog("Watchdog", "Cleanup checked=\${res.optInt("scannedCount")} killed=\${res.optInt("killedCount")} manual=$manual")
                    writeJson(out, 200, res)
                }

                method == "POST" && path == "/shell" -> {
                    val cmd = bodyJson.optString("command", "").trim()
                    if (cmd.isEmpty()) {
                        writeJson(out, 400, JSONObject().put("error", "Missing command"))
                    } else {
                        val res = runBufferedShellCommand(cmd)
                        writeJson(out, 200, res)
                    }
                }

                method == "POST" && (path == "/run-stream" || path == "/install-stream" || path == "/shell-stream") -> {
                    val shellCmd = when (path) {
                        "/run-stream" -> {
                            val arr = bodyJson.optJSONArray("files") ?: JSONArray()
                            for (i in 0 until arr.length()) {
                                val f = arr.getJSONObject(i)
                                val name = File(f.optString("name", "")).name
                                if (name.isNotBlank()) {
                                    File(workspaceDir, name).writeText(f.optString("content", ""))
                                }
                            }
                            val entry = File(bodyJson.optString("entry", "main.py")).name.ifBlank { "main.py" }
                            val safeEntrySh = entry.replace("'", "'\\\\''")
                            val pyPath = File(usrDir, "bin/python").absolutePath
                            val py3Path = File(usrDir, "bin/python3").absolutePath
                            val binDirPath = File(usrDir, "bin").absolutePath
                            "PY_BIN=\\"$pyPath\\"; [ -x \\"\${'$'}PY_BIN\\" ] || PY_BIN=\\"$py3Path\\"; if [ ! -x \\"\${'$'}PY_BIN\\" ]; then for c in \\"$binDirPath/python3.\\"*; do [ -f \\"\${'$'}c\\" ] || continue; case \\"\${'$'}c\\" in *-config) continue ;; esac; chmod 755 \\"\${'$'}c\\" 2>/dev/null || true; PY_BIN=\\"\${'$'}c\\"; break; done; fi; if [ ! -x \\"\${'$'}PY_BIN\\" ]; then echo \\"[DroidPy] 尚未安裝 Termux 原生 Python！請至「Termux 橋接」點擊「一鍵初始化 Python + 爬蟲環境」，或先將終端機切換為「沙盒」執行。\\"; exit 127; fi; exec \\"\${'$'}PY_BIN\\" -u '$safeEntrySh'"
                        }
                        "/install-stream" -> {
                            val mode = bodyJson.optString("mode", "pip")
                            val target = bodyJson.optString("target", "").trim()
                            val trustedHost = bodyJson.optBoolean("trustedHost", false)
                            val pythonCmd = File(usrDir, "bin/python3").absolutePath
                            if (mode == "pkg") {
                                "pkg install -y $target"
                            } else if (trustedHost) {
                                "$pythonCmd -m pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org $target"
                            } else {
                                "$pythonCmd -m pip install --no-cache-dir $target"
                            }
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
                    try {
                        writeJson(out, 200, probeUrlSafely(bodyJson.optString("url", "").trim(), bodyJson))
                    } catch (e: IllegalArgumentException) {
                        writeJson(out, 400, JSONObject().put("error", e.message ?: "Invalid probe URL"))
                    } catch (_: Exception) {
                        writeJson(out, 502, JSONObject().put("error", "Unable to safely probe target URL"))
                    }
                }

                else -> writeJson(out, 404, JSONObject().put("error", "Not found"))
            }
        }
    }

    private data class SafeProbeResponse(
        val statusCode: Int,
        val headers: Map<String, List<String>>,
        val body: ByteArray
    )

    private fun isPublicProbeAddress(address: InetAddress): Boolean {
        if (address.isAnyLocalAddress || address.isLoopbackAddress ||
            address.isLinkLocalAddress || address.isSiteLocalAddress ||
            address.isMulticastAddress) return false
        val b = address.address.map { it.toInt() and 0xff }
        if (address is Inet4Address) {
            val a0 = b[0]
            val a1 = b[1]
            val a2 = b[2]
            if (a0 == 0 || a0 == 10 || a0 == 127 || a0 >= 224) return false
            if (a0 == 100 && a1 in 64..127) return false
            if (a0 == 169 && a1 == 254) return false
            if (a0 == 172 && a1 in 16..31) return false
            if (a0 == 192 && (a1 == 0 || a1 == 2 || a1 == 168)) return false
            if (a0 == 192 && a1 == 88 && a2 == 99) return false
            if (a0 == 192 && a1 == 31 && a2 == 196) return false
            if (a0 == 192 && a1 == 52 && a2 == 193) return false
            if (a0 == 192 && a1 == 175 && a2 == 48) return false
            if (a0 == 198 && a1 in 18..19) return false
            if (a0 == 198 && a1 == 51 && a2 == 100) return false
            if (a0 == 203 && a1 == 0 && a2 == 113) return false
            return true
        }
        if (address is Inet6Address) {
            if ((b[0] and 0xe0) != 0x20) return false
            if (b[0] == 0x20 && b[1] == 0x01) {
                if (b[2] == 0x0d && b[3] == 0xb8) return false
                if (b[2] == 0x00 && b[3] <= 0x01) return false
                if (b[2] == 0x00 && b[3] == 0x02) return false
                if (b[2] == 0x00 && b[3] == 0x10) return false
                if (b[2] == 0x00 && b[3] == 0x20) return false
            }
            if (b[0] == 0x20 && b[1] == 0x02) return false
            if (b[0] == 0x3f && b[1] == 0xff) return false
            return true
        }
        return false
    }

    private fun validateProbeUrl(url: URL): String {
        val scheme = url.protocol.lowercase()
        if (scheme != "http" && scheme != "https") {
            throw IllegalArgumentException("Only HTTP and HTTPS URLs are allowed")
        }
        if (URI(url.toString()).rawUserInfo != null) {
            throw IllegalArgumentException("URLs containing credentials are not allowed")
        }
        val rawHost = url.host.removePrefix("[").removeSuffix("]").trimEnd('.').lowercase()
        if (rawHost.isBlank() || rawHost == "localhost" ||
            rawHost.endsWith(".localhost") || rawHost.endsWith(".local") ||
            rawHost.endsWith(".internal") || rawHost.endsWith(".test") ||
            rawHost.contains("%")) {
            throw IllegalArgumentException("Local hostnames and scoped IP addresses are not allowed")
        }
        return if (rawHost.contains(":")) rawHost else IDN.toASCII(rawHost)
    }

    private fun readProbeLine(input: BufferedInputStream, maxBytes: Int = 8192): String {
        val output = ByteArrayOutputStream()
        while (true) {
            val value = input.read()
            if (value < 0) {
                if (output.size() == 0) return ""
                break
            }
            if (value == 10) break
            if (value != 13) output.write(value)
            if (output.size() > maxBytes) throw IllegalArgumentException("HTTP response header line too large")
        }
        return output.toString("ISO-8859-1")
    }

    private fun readProbeExact(input: BufferedInputStream, output: ByteArrayOutputStream, count: Int) {
        var remaining = count
        val buffer = ByteArray(4096)
        while (remaining > 0) {
            val n = input.read(buffer, 0, minOf(buffer.size, remaining))
            if (n < 0) throw java.io.EOFException("Incomplete HTTP response body")
            output.write(buffer, 0, n)
            remaining -= n
        }
    }

    private fun readProbeBody(input: BufferedInputStream, headers: Map<String, List<String>>): ByteArray {
        val maxBytes = 24000
        val output = ByteArrayOutputStream()
        val transferEncoding = headers["transfer-encoding"]?.joinToString(",")?.lowercase().orEmpty()
        if (transferEncoding.isNotBlank() && headers.containsKey("content-length")) {
            throw IllegalArgumentException("Ambiguous HTTP response framing")
        }
        if (transferEncoding.isNotBlank() && transferEncoding.trim() != "chunked") {
            throw IllegalArgumentException("Unsupported HTTP transfer encoding")
        }
        if (transferEncoding.contains("chunked")) {
            while (output.size() < maxBytes) {
                val sizeLine = readProbeLine(input).substringBefore(';').trim()
                val chunkSize = sizeLine.toLongOrNull(16)
                    ?: throw IllegalArgumentException("Invalid chunked response")
                if (chunkSize < 0L) throw IllegalArgumentException("Invalid chunk size")
                if (chunkSize == 0L) {
                    while (readProbeLine(input).isNotEmpty()) { }
                    break
                }
                val remaining = maxBytes - output.size()
                val toRead = minOf(chunkSize, remaining.toLong()).toInt()
                readProbeExact(input, output, toRead)
                if (toRead.toLong() < chunkSize) break
                if (input.read() != 13 || input.read() != 10) {
                    throw IllegalArgumentException("Invalid chunk delimiter")
                }
            }
            return output.toByteArray()
        }
        val contentLengths = headers["content-length"]
        if (contentLengths != null && contentLengths.size != 1) {
            throw IllegalArgumentException("Ambiguous Content-Length")
        }
        val lengthHeader = contentLengths?.firstOrNull()
        if (lengthHeader != null) {
            val length = lengthHeader.toLongOrNull()
                ?: throw IllegalArgumentException("Invalid Content-Length")
            if (length < 0) throw IllegalArgumentException("Invalid Content-Length")
            readProbeExact(input, output, minOf(length, maxBytes.toLong()).toInt())
            return output.toByteArray()
        }
        val buffer = ByteArray(4096)
        while (output.size() < maxBytes) {
            val n = input.read(buffer, 0, minOf(buffer.size, maxBytes - output.size()))
            if (n < 0) break
            if (n > 0) output.write(buffer, 0, n)
        }
        return output.toByteArray()
    }

    private fun performPinnedProbeRequest(url: URL, requestHeaders: Map<String, String>): SafeProbeResponse {
        val host = validateProbeUrl(url)
        val port = if (url.port > 0) url.port else if (url.protocol.equals("https", true)) 443 else 80
        val addresses = InetAddress.getAllByName(host)
        if (addresses.isEmpty() || addresses.any { !isPublicProbeAddress(it) }) {
            throw IllegalArgumentException("Target resolves to a non-public IP address")
        }
        var lastError: Exception? = null
        for (pinnedAddress in addresses) {
            try {
                val rawSocket = Socket()
                try {
                    rawSocket.connect(InetSocketAddress(pinnedAddress, port), 15000)
                    rawSocket.soTimeout = 18000
                } catch (error: Exception) {
                    try { rawSocket.close() } catch (_: Exception) {}
                    throw error
                }
                val activeSocket: Socket = if (url.protocol.equals("https", true)) {
                    try {
                        val factory = SSLSocketFactory.getDefault() as SSLSocketFactory
                        val ssl = factory.createSocket(rawSocket, host, port, true) as SSLSocket
                        val parameters = ssl.sslParameters
                        parameters.endpointIdentificationAlgorithm = "HTTPS"
                        if (!host.contains(":") && !host.matches(Regex("^[0-9.]+$"))) {
                            parameters.serverNames = listOf(SNIHostName(host))
                        }
                        ssl.sslParameters = parameters
                        ssl.startHandshake()
                        ssl
                    } catch (error: Exception) {
                        try { rawSocket.close() } catch (_: Exception) {}
                        throw error
                    }
                } else {
                    rawSocket
                }

                activeSocket.use { socket ->
                    val hostHeader = if (host.contains(":")) "[$host]" else host
                    val authority = if ((url.protocol.equals("https", true) && port == 443) ||
                        (url.protocol.equals("http", true) && port == 80)) hostHeader else "$hostHeader:$port"
                    val requestTarget = (url.path.ifBlank { "/" }) + (url.query?.let { "?" + it } ?: "")
                    if (requestTarget.contains("\\r") || requestTarget.contains("\\n")) {
                        throw IllegalArgumentException("Invalid request path")
                    }
                    val request = StringBuilder()
                        .append("GET ").append(requestTarget).append(" HTTP/1.1\\r\\n")
                        .append("Host: ").append(authority).append("\\r\\n")
                        .append("Connection: close\\r\\n")
                        .append("Accept-Encoding: identity\\r\\n")
                    for ((name, value) in requestHeaders) {
                        request.append(name).append(": ").append(value).append("\\r\\n")
                    }
                    request.append("\\r\\n")
                    socket.getOutputStream().write(request.toString().toByteArray(Charsets.ISO_8859_1))
                    socket.getOutputStream().flush()

                    val input = BufferedInputStream(socket.getInputStream())
                    val statusLine = readProbeLine(input)
                    val statusParts = statusLine.split(" ", limit = 3)
                    val statusCode = statusParts.getOrNull(1)?.toIntOrNull()
                        ?: throw IllegalArgumentException("Invalid HTTP status line")
                    val responseHeaders = linkedMapOf<String, MutableList<String>>()
                    var totalHeaderBytes = statusLine.length
                    var headerCount = 0
                    while (true) {
                        val line = readProbeLine(input)
                        if (line.isEmpty()) break
                        totalHeaderBytes += line.length
                        headerCount++
                        if (totalHeaderBytes > 32768 || headerCount > 100) {
                            throw IllegalArgumentException("HTTP response headers too large")
                        }
                        val separator = line.indexOf(':')
                        if (separator <= 0) throw IllegalArgumentException("Invalid HTTP response header")
                        val name = line.substring(0, separator).trim().lowercase()
                        val value = line.substring(separator + 1).trim()
                        responseHeaders.getOrPut(name) { mutableListOf() }.add(value)
                    }
                    val body = readProbeBody(input, responseHeaders)
                    return SafeProbeResponse(statusCode, responseHeaders, body)
                }
            } catch (error: Exception) {
                lastError = error
            }
        }
        throw lastError ?: java.io.IOException("No reachable public address for target")
    }

    private fun probeOrigin(url: URL): String {
        val host = url.host.lowercase()
        val port = if (url.port > 0) url.port else if (url.protocol.equals("https", true)) 443 else 80
        return url.protocol.lowercase() + "://" + host + ":" + port
    }

    private fun buildProbeHeaders(bodyJson: JSONObject): MutableMap<String, String> {
        val userAgent = bodyJson.optString("userAgent", "").ifBlank {
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
        }
        if (userAgent.length > 512 || userAgent.any { it.code < 32 && it.code != 9 } || userAgent.contains(127.toChar())) {
            throw IllegalArgumentException("Invalid User-Agent header")
        }
        val headers = linkedMapOf(
            "User-Agent" to userAgent,
            "Accept" to "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
        )
        val cookie = bodyJson.optString("cookieHeader", "").trim()
        if (cookie.isNotEmpty()) {
            if (cookie.length > 8192 || cookie.any { it.code < 32 && it.code != 9 } || cookie.contains(127.toChar())) {
                throw IllegalArgumentException("Invalid Cookie header")
            }
            headers["Cookie"] = cookie
        }
        val forbidden = setOf(
            "host", "connection", "content-length", "transfer-encoding",
            "proxy-authorization", "proxy-connection", "keep-alive",
            "upgrade", "te", "trailer", "cookie", "accept-encoding"
        )
        val extra = bodyJson.optJSONObject("extraHeaders")
        if (extra != null) {
            if (extra.length() > 32) throw IllegalArgumentException("Too many custom headers")
            val keys = extra.keys()
            while (keys.hasNext()) {
                val name = keys.next().trim()
                val value = extra.optString(name, "")
                if (name.isBlank() || name.length > 128 || value.length > 4096 ||
                    !Regex("^[A-Za-z0-9!#$%&'*+.^_|~-]+$").matches(name) ||
                    value.any { it.code < 32 && it.code != 9 } || value.contains(127.toChar()) ||
                    name.lowercase() in forbidden) {
                    throw IllegalArgumentException("Invalid or restricted custom header")
                }
                val existingName = headers.keys.firstOrNull { it.equals(name, ignoreCase = true) }
                headers[existingName ?: name] = value
            }
        }
        return headers
    }

    private fun probeUrlSafely(targetUrl: String, bodyJson: JSONObject): JSONObject {
        if (targetUrl.isBlank() || targetUrl.length > 4096 || targetUrl.any { it.isWhitespace() }) {
            throw IllegalArgumentException("Invalid or oversized URL")
        }
        var current = URL(targetUrl)
        val headers = buildProbeHeaders(bodyJson)
        for (redirectCount in 0..5) {
            val response = performPinnedProbeRequest(current, headers)
            val location = response.headers["location"]?.firstOrNull()
            if (response.statusCode in setOf(301, 302, 303, 307, 308) &&
                !location.isNullOrBlank() && redirectCount < 5) {
                val next = URL(current, location)
                if (probeOrigin(current) != probeOrigin(next)) {
                    headers.keys.removeAll { it.lowercase() in setOf("cookie", "authorization", "proxy-authorization", "referer") }
                }
                current = next
                continue
            }
            val bodyText = String(response.body, Charsets.UTF_8)
            val setCookies = JSONArray()
            val responseHeaders = JSONObject()
            response.headers.forEach { (name, values) ->
                if (name.equals("set-cookie", true)) {
                    values.forEach { setCookies.put(it.take(4096)) }
                } else {
                    responseHeaders.put(name, values.joinToString(", ").take(2048))
                }
            }
            val titleMatch = Regex("<title[^>]*>(.*?)</title>", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)).find(bodyText)
            val title = titleMatch?.groupValues?.getOrNull(1)?.replace(Regex("\\\\s+"), " ")?.trim() ?: ""
            return JSONObject()
                .put("ok", response.statusCode in 200..399)
                .put("url", targetUrl)
                .put("finalUrl", current.toString())
                .put("statusCode", response.statusCode)
                .put("title", title)
                .put("setCookies", setCookies)
                .put("headers", responseHeaders)
                .put("bodyPreview", bodyText.take(8000))
        }
        throw IllegalArgumentException("Too many redirects")
    }

    private fun runBufferedShellCommand(command: String): JSONObject {
        val t0 = System.currentTimeMillis()
        val shFile = File(usrDir, "bin/sh")
        var code = 1
        var stdoutText = ""
        val isPkgOrPip = command.contains("pip") || command.contains("pkg") || command.contains("apt")
        if (!shFile.exists()) {
            stdoutText = "[DroidPy] Bootstrap sh not ready"
        } else {
            var proc: Process? = null
            try {
                val pb = ProcessBuilder(shFile.absolutePath, "-c", command)
                pb.directory(workspaceDir)
                pb.redirectErrorStream(true)
                pb.environment().putAll(buildEnv())
                proc = pb.start()
                stdoutText = proc.inputStream.bufferedReader(Charsets.UTF_8).readText()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val done = proc.waitFor(120, java.util.concurrent.TimeUnit.SECONDS)
                    code = if (done) proc.exitValue() else 124
                    if (!done) proc.destroyForcibly()
                } else {
                    code = proc.waitFor()
                }
            } catch (e: Exception) {
                stdoutText = e.message ?: "Shell execution error"
            } finally {
                try { proc?.inputStream?.close() } catch (_: Exception) {}
                try { proc?.errorStream?.close() } catch (_: Exception) {}
                try { proc?.outputStream?.close() } catch (_: Exception) {}
                if (isPkgOrPip) {
                    pruneStaleCacheAndTemp(clearAptLists = false)
                }
            }
        }
        if (code == 0 && isPkgOrPip) {
            val isUninstall = command.contains("uninstall") || command.contains("remove") || command.contains("purge")
            savePackageBackupSnapshot(forceShrink = isUninstall)
        }
        return JSONObject()
            .put("exitCode", code)
            .put("stdout", stripAnsiForLog(stdoutText))
            .put("stderr", "")
            .put("durationMs", System.currentTimeMillis() - t0)
    }

    private fun streamShellCommand(out: OutputStream, command: String) {
        val t0 = System.currentTimeMillis()
        val shFile = File(usrDir, "bin/sh")
        val isPkgOrPip = command.contains("pip") || command.contains("pkg") || command.contains("apt")
        appendNativeLog("Exec", "Stream shell start: \${command.take(180)}")

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
            try {
                sendStdout("[DroidPy] Waiting for Termux bootstrap extraction...\\n")
            } catch (_: Exception) {
                return
            }
            var waited = 0
            while (!shFile.exists() && waited < 45000) {
                try { Thread.sleep(250) } catch (_: InterruptedException) { break }
                waited += 250
            }
        }

        var code = 1
        val outputTail = StringBuilder()
        fun recordTail(chunk: String) {
            val cleaned = stripAnsiForLog(chunk)
            if (cleaned.isNotEmpty()) {
                outputTail.append(cleaned)
                if (outputTail.length > 2400) {
                    outputTail.delete(0, outputTail.length - 1600)
                }
            }
        }
        if (!shFile.exists()) {
            appendNativeLog("Exec", "Bootstrap missing sh at \${shFile.absolutePath}")
            try {
                sendStdout("[DroidPy] Bootstrap not ready at \${shFile.absolutePath}\\n")
            } catch (_: Exception) {
            }
        } else {
            var proc: Process? = null
            try {
                val pb = ProcessBuilder(shFile.absolutePath, "-c", command)
                pb.directory(workspaceDir)
                pb.redirectErrorStream(true)
                pb.environment().putAll(buildEnv())

                proc = pb.start()
                activeProcess = proc
                activeProcessStartedAt.set(System.currentTimeMillis())
                val charBuf = CharArray(1024)
                val inpReader = InputStreamReader(proc.inputStream, Charsets.UTF_8)
                while (true) {
                    val n = inpReader.read(charBuf)
                    if (n < 0) break
                    if (n > 0) {
                        val s = String(charBuf, 0, n)
                        recordTail(s)
                        try {
                            sendStdout(s)
                        } catch (_: Exception) {
                            proc.destroyForcibly()
                            break
                        }
                    }
                }
                code = proc.waitFor()
            } catch (e: Exception) {
                appendNativeLog("Exec", "Exec exception: \${e.message}")
                recordTail("[DroidPy] Exec error: \${e.message}\\n")
                try {
                    sendStdout("[DroidPy] Exec error: \${e.message}\\n")
                } catch (_: Exception) {
                }
            } finally {
                try { proc?.inputStream?.close() } catch (_: Exception) {}
                try { proc?.errorStream?.close() } catch (_: Exception) {}
                try { proc?.outputStream?.close() } catch (_: Exception) {}
                activeProcess = null
                activeProcessStartedAt.set(0L)
                if (isPkgOrPip) {
                    pruneStaleCacheAndTemp(clearAptLists = false)
                }
            }
        }

        val elapsed = System.currentTimeMillis() - t0
        appendNativeLog("Exec", "Stream shell finished: exitCode=$code, durationMs=$elapsed")
        if (code == 0 && isPkgOrPip) {
            val isUninstall = command.contains("uninstall") || command.contains("remove") || command.contains("purge")
            savePackageBackupSnapshot(forceShrink = isUninstall)
        }
        if (code != 0 && outputTail.isNotBlank()) {
            val tailCompact = stripAnsiForLog(outputTail.toString()).trim().takeLast(1200)
            appendNativeLog("Exec", "Non-zero exit ($code) output tail:\\n$tailCompact")
        }

        val doneLine = JSONObject()
            .put("type", "done")
            .put("exitCode", code)
            .put("durationMs", elapsed)
            .toString() + "\\n"
        try {
            out.write(doneLine.toByteArray(Charsets.UTF_8))
            out.flush()
        } catch (_: Exception) {
        }
    }

    private fun corsHeaders(allowPrivateNetwork: Boolean = false): String {
        val pnaHeader = if (allowPrivateNetwork) "Access-Control-Allow-Private-Network: true\\r\\n" else ""
        return "Access-Control-Allow-Origin: $allowedOrigin\\r\\n" +
            "Vary: Origin\\r\\n" +
            pnaHeader +
            "Access-Control-Allow-Methods: GET, POST, OPTIONS\\r\\n" +
            "Access-Control-Allow-Headers: Content-Type, X-DroidPy-Token\\r\\n"
    }

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

    private fun writeHeaders(
        out: OutputStream,
        status: Int,
        contentType: String,
        length: Int,
        allowPrivateNetwork: Boolean = false
    ) {
        out.write((
            "HTTP/1.1 $status \${statusReason(status)}\\r\\n" +
            corsHeaders(allowPrivateNetwork) +
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

  // 6. Launcher icon resources & deterministic APK signing keystore
  // Never include a private signing key in exported Android projects.
  zip.file('android/app/src/main/res/drawable/ic_launcher_background.xml', ANDROID_ICON_BACKGROUND_XML);
  zip.file('android/app/src/main/res/drawable/ic_launcher_foreground.xml', ANDROID_ICON_FOREGROUND_XML);
  zip.file('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', ANDROID_ADAPTIVE_ICON_XML);
  zip.file('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', ANDROID_ADAPTIVE_ICON_XML);
  for (const [density, b64] of Object.entries(ANDROID_MIPMAP_PNG_BASE64)) {
    zip.file(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`, b64, { base64: true });
    zip.file(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`, b64, { base64: true });
  }

  // 7. Seed user's current Python workspace files into android/app/src/main/assets/workspace/
  for (const file of opts.files) {
    zip.file(`android/app/src/main/assets/workspace/${file.name}`, file.content);
  }

  // 8. README.md (rendered automatically by GitHub) + README_GITHUB_APK.md
  const githubApkReadme = `# ${safeTitle} 獨立 Android APK（GitHub 自動打包專案）

本專案已預先配置好 **GitHub Actions 自動編譯流程**、**內嵌 Termux Bootstrap 環境**、**受保護的 APK Release 簽名流程** 與 **原生爬蟲瀏覽器（Cookie 擷取）**：
打包成 APK 安裝至手機後，**無須另外安裝 Termux App**，也不受瀏覽器 CORS 限制，可直接執行 Python 網路爬蟲（\`requests\`、\`beautifulsoup4\`、\`lxml\`、\`yt-dlp\`）、\`ffmpeg\` 與 \`clang\` 原生套件。

## 發布與自動打包步驟

1. 在 GitHub 建立一個新的公開或私人倉庫（Repository）。
2. 將本壓縮檔解壓縮後的所有檔案（包含 \`.github/\` 與 \`android/\`）上傳／Push 到該倉庫的 \`main\` 分支。
   - 若倉庫同時包含前端原始碼（\`package.json\`），Workflow 會自動執行 \`npm ci && npm run build\` 並複製進 \`android/app/src/main/assets/www/\` 打包為完全離線 APK。
3. 在 GitHub Repository → Settings → Secrets and variables → Actions，為正式發布設定新的簽名 Secrets：\`DROIDPY_KEYSTORE_BASE64\`、\`DROIDPY_STORE_PASSWORD\`、\`DROIDPY_KEY_ALIAS\`、\`DROIDPY_KEY_PASSWORD\`。請使用自己新建立的 keystore；不要把 keystore、Base64 或密碼提交到 Git。妥善離線備份 keystore 與密碼，遺失後將無法再以同一憑證發布更新。
4. PR／Debug 建置使用臨時 Debug 簽名，不需要 Release Secrets；合併至 main/master 後，push workflow 會自動使用新的受保護 keystore 建置 Release APK、比對 APK 與 keystore 的 SHA-256 憑證指紋，成功後才發布 GitHub Release。缺少 Secrets、解碼失敗或簽名不一致時會停止，不會發布。
5. **簽名金鑰已更換**：舊版已安裝 App 的簽名與新金鑰不同，不能直接覆蓋更新。請先使用 App 內備份功能匯出工作區／狀態資料，再解除安裝舊版並安裝新 Release；重新安裝後再匯入備份。

## 首次開啟 App 初始化說明

1. APK 首次啟動時會自動將內嵌 Termux Bootstrap 解壓至 App 私有目錄並啟動 \`127.0.0.1:8765\` 橋接服務。
2. 開啟 DroidPy 後進入 **「Termux 橋接」**，點擊 **「一鍵初始化 Python + 爬蟲環境」**，系統將自動安裝：
   \`(pkg update -y || true) && pkg install -y python python-pip python-lxml libxml2 libxslt clang && pip install --no-cache-dir requests beautifulsoup4 httpx\`
3. 如需抓取需登入的網站資料，開啟 **「爬蟲瀏覽器」** → 點擊 **「APK 原生瀏覽器登入抓 Cookie」** 完成登入並點右上角 **「擷取 Cookie」**，即可直接讀取包含 \`HttpOnly\` 的認證 Cookie 並寫入工作區 \`cookies.json\`。
`;

  const changelogContent = `# Changelog / 更新日誌

## [1.2.16] - 2026-11-24
- **深度修復 \`pip\` \`truststore\` \`Errno 13\`、選項獨立視窗設計、手機文字防溢出與寫實 3D 四季天光**：
  - 於 \`sitecustomize.py\` 植入記憶體備援 certifi CA 憑證與攔截 \`truststore\` / \`load_verify_locations\`，配合 \`pip.conf\` 與目錄權限規範徹底根除 Android Python 3.14 \`PermissionError: [Errno 13]\`。
  - 工具箱抽屜改採「選項目錄 → 獨立操作視窗（頂部附返回按鈕）」，全面精簡「Python／內建 Python」文案並修復 360px 手機版文字按鈕溢出問題。
  - 升級 Three.js 寫實 3D 背景支援春櫻／夏雨／秋楓／冬雪與真實晨昏星月天光漸變。

## [1.2.14] - 2026-11-23
- **修復「已安裝套件為空」、安裝失敗暫存清理、亂碼淨化、\`/shell\` 404 與長時使用卡頓**：
  - \`EmbeddedTermuxBridge.kt\` 擴大掃描 \`site-packages\`／\`dist-packages\` 並補上 \`importlib.metadata\` 回退驗證、移除 \`EXTERNALLY-MANAGED\`、導出 \`PIP_USER=0\`／\`PIP_NO_CACHE_DIR=1\` 與 \`PYTHONUTF8=1\`。
  - 開機與每次 \`pip\`／\`pkg\` 結束自動清理 \`tmp/pip-*\`、\`.cache/pip\`、\`tmp_pkg_stage\` 與 \`.deb\` 暫存，新增 \`GET /storage/app-usage\`、\`POST /storage/cleanup\` 與 \`POST /shell\`。
  - 強化 ANSI 與控制字元淨化、隱藏「純淨文字」按鈕，並最佳化手機介面不溢出與長時運行流暢度。

## [1.2.13] - 2026-11-23
- **原生 Python 直譯器預設、沙盒轉為附加功能、ANSI 純淨文字與跨環境路徑／重裝還原修復**：
  - 預設執行引擎改為原生 **Python 直譯器**（Termux／內嵌 ARM64），**Pyodide WASM 沙盒**轉為設定內可開啟的附加功能，終端與面板按鈕同步精簡並補強 \`subprocess\`（Errno 138）、無 \`wasm32\` wheel 套件（如 \`parsel\`）與互動輸入 \`KeyboardInterrupt\` 友善防呆。
  - 新增序列緩衝與強效 ANSI 控制碼淨化器（根除 \`[0m\`、\`[38;5;...m\`、\`;88mO\`、\`91mn\` 殘留），原生 Android \`droidpy_native.log\` 與匯出日誌全面濾除跳脫序列，終端機工具列與編輯器設定加入「純淨文字模式」。
  - 腳本執行與 \`droid.device_info()\` 環境偵測預設為手機（Android）環境。
  - 修正 \`/health\` \`pipPkgs\` 讀取 \`METADATA\`/\`PKG-INFO\` 精準計數、\`termuxFetch\` 404/錯誤詳情回報消除 \`Unhandled rejection: Not found\`；強化重裝／更新保留 \`usr/\` 與 \`/sdcard/DroidPy/.droidpy_backup/\` 套件清單備份與一鍵還原。
  - 所有「日誌」按鈕名稱統一精簡為「日誌」，裝置儲存文案改為「手機」。

## [1.2.12] - 2026-11-22
- **終端機實時時分秒計時（\`HH:MM:SS\`）、套件解除安裝、精準更新檢測與長按選字複製修復**：
  - 終端機與程式執行日誌耗時由毫秒全面改為 \`HH:MM:SS\`，執行期間每秒／每 250ms 即時跳動顯示經過時間。
  - 程式內更新視窗改為僅顯示當前安裝版本或目標新版本的更新日誌，精簡閱讀體驗。
  - Pyodide 沙盒與 Termux 原生引擎同步新增「解除安裝」功能（\`micropip.uninstall\`／\`pip uninstall -y\`／\`pkg uninstall -y\`＋重定位 \`dpkg/status\` 清理）並保護核心系統套件；新增「一鍵更新所有套件」統一按鈕。
  - 實作 PEP 440 版本比對與 \`cp312\`/\`emscripten\`/\`none-any.whl\` 過濾＋Termux \`pip list --outdated --format=json\` 實測檢查，徹底修正已安裝最新版套件仍誤報「可更新」的問題；並確保「啟動時自動更新套件」僅於開啟程式時執行一次。
  - 修復手機 Android WebView 非編輯區與終端機區長按無法選字複製的問題（\`isLongClickable\`、\`.terminal-selectable\`/\`.selectable-text\`、選取時暫停自動捲底、終端機「複製選取」快捷按鈕＋原生 \`ClipboardManager\` 三重複製回退）。

## [1.2.11] - 2026-11-22
- **新增更多趣味 Python 腳本範例、分類篩選與熱門／冷門 60+ 完整套件目錄**：
  - 範本庫新增數位雨、曼德布羅碎形、生命遊戲、迷宮尋路、21 點、猜數字、Wordle、Hacker News 爬蟲、CSV 視覺化、愛心曲線、番茄鐘、密碼生成器等共 18 支即跑範例與 7 大分類篩選。
  - 套件目錄擴充 60+ 熱門與冷門實用套件（7 大分類）並加入即時模糊聯想提示與 Termux APT 名稱指引，同時支援手動與啟動時自動更新已安裝套件。
  - 新增程式內 GitHub Release 版本檢查、更新日誌展示與原生 \`FileProvider\` APK 下載覆蓋安裝功能；並於 \`buildEnv()\` 導出 \`SHELL\`／\`CONFIG_SHELL\`／\`CMAKE_SH\` 徹底修復 \`make[1]: /data/data/com.termux/files/usr/bin/sh: Permission denied\` 錯誤。

## [1.2.10] - 2026-11-22
- **根治實機 \`PermissionError: [Errno 13] Permission denied\`（\`pip\` Truststore 與 C 擴充編譯 \`build_clib\`）**：
  - \`pip\` Wrapper 於執行時動態偵測可用 CA 憑證（含備援複製 \`certifi.where()\`）並強制設定 \`PIP_CERT\`／\`SSL_CERT_DIR\`，徹底避免一鍵初始化同一次執行鏈中 \`pip\` 呼叫 \`_create_truststore_ssl_context()\` 存取舊路徑觸發 \`Errno 13\`。
  - \`relocate_debs()\` 與 \`buildEnv()\` 自動重寫 \`_sysconfigdata*.py\`／\`Makefile\`／\`pkgconfig\` 內的舊 Termux 路徑、為 \`etc\`／\`lib\`／\`llvm\` 工具鏈設定正確權限，並於偵測到 \`clang\` 時導出 \`CC\`、\`CXX\`、\`AR\`、\`RANLIB\`、\`LDSHARED\`，解決編譯 C 擴充庫時的 \`Permission denied\`。
  - Termux 快捷套件新增預編譯 \`python-pillow\`、\`python-lxml\` 與純 Python \`flask\`。

## [1.2.9] - 2026-11-22
- **修復實機日誌回報之 \`pip install\` 退出碼 2 與 \`pkg update\` 退出碼 100 問題**：
  - 遞迴修復 \`usr/etc\`、\`usr/share\`、\`usr/lib\` 與 \`usr/bin\` 符號連結，並改以 \`resolveCaBundleFile()\` 僅於憑證檔實際存在時才設定 \`PIP_CERT\`／\`SSL_CERT_FILE\`／\`REQUESTS_CA_BUNDLE\`（避免無 \`etc/tls/cert.pem\` 時 \`pip\` 因找不到憑證路徑而直接以 \`exit=2\` 崩潰），同時補齊 \`PIP_CACHE_DIR\` 與 \`ensurepip\` 回退檢查。
  - 為 \`sources.list*\` 補上 \`[trusted=yes]\` 與重定位路徑修正，並於 \`APT_OPTS\` 補齊 \`AllowDowngradeToInsecureRepositories\` 與 \`apt-key\`／\`gpgv\` 路徑，解決 \`pkg update\` 退出碼 \`100\`。
  - 加強 \`droidpy_native.log\` 與前端 \`appLogger\`：非 0 結束碼之指令自動記錄錯誤輸出尾段；\`chart_demo.py\` 缺少 \`matplotlib\` 時提供清楚引擎切換提示。

## [1.2.8] - 2026-11-21
- **徹底修復 Termux Python / 套件重開機恢復預設與 \`apt.conf.d\` Permission denied**：
  - \`MainActivity.kt\` 改以 \`.droidpy_bootstrap_ok\` 標記與多路徑檢查保護 \`filesDir/usr\`，並於啟動時自動修復 \`bin/sh\` 與符號連結，永不再因 symlink 異常而重設清空已安裝的 Python 與爬蟲套件。
  - \`EmbeddedTermuxBridge.kt\` 每次執行皆無條件寫入完整 \`etc/apt/apt.conf\`（含 \`Dir::Etc::parts\` 等核心路徑）並改寫殘留路徑與更新 \`dpkg/status\`，同時於 \`/health\` 回傳已保留的 pip / pkg 套件清單。
  - 沙盒模式（Pyodide）同步持久化已安裝套件清單並於重啟時自動恢復；執行 \`utils.py\` 等模組檔新增 \`__main__\` 輸出與明確執行完成提示。
- **適配手機與平板操作差異、將低頻功能移入負屏抽屜、保留歷史版本 APK 並加入「程式執行所有日誌」**：
  - 新增應用程式全生命週期日誌記錄器與 Android 原生 \`/logs\`（含 \`droidpy_native.log\` 與 \`logcat\`）檢視匯出面板。

## [1.2.7] - 2026-11-21
- 歷史版本曾使用固定簽名金鑰；目前正式發布改用使用者自行保管的 GitHub Actions keystore Secrets。直接更換憑證會使舊版 APK 無法原地覆蓋更新，需先備份 App 資料再重新安裝。

## [1.2.6] - 2026-11-21
- 修復「授權資料夾」、「授權本機資料夾」與「更新容量」三個按鈕點擊無響應問題：移除裝置目錄按鈕的 \`disabled\` 鎖死，在 APK 環境直接串接 Android 內部儲存權限設定與 \`StatFs\` 真實裝置容量並即時跳出更新提示；在一般瀏覽器／iframe 環境自動退回原生資料夾檔案選擇器 (\`webkitdirectory\`)。
- 修復獨立 APK 內嵌 Termux 初始化失敗（截圖中 \`apt.conf.d Permission denied\`、\`InRelease\` 金鑰失效、\`relocate_debs\` 解壓靜默中止與 Python 3.14 編譯 \`lxml\` 失敗問題）：改以 \`tar --overwrite\` 精準搬移 \`.deb\` 檔案並顯示即時解壓進度、補齊 \`Dir::Etc::parts\` / \`APT_CONFIG\` / 金鑰符號連結修正、改用預編譯 \`python-lxml\`，並確保完成後立即刷新 Python 偵測狀態。

## [1.2.5] - 2026-11-21
- 為 Android 獨立 APK 加上 DroidPy 專屬應用程式圖徽（Adaptive Vector Icon + 全解析度 \`mipmap-*\` PNG 回退），於系統桌面、多工視圖與安裝畫面顯示標誌性翡翠綠＋琥珀橘 Logo。
- 在 \`MainActivity.kt\` 加入「返回兩次退出 App」防誤觸保護：於主畫面首次按下返回鍵（或全面屏側滑返回）顯示 2 秒「再按一次返回鍵退出 DroidPy」提示，2 秒內再次返回即立即寫盤儲存並安全退出。

## [1.2.4] - 2026-11-21
- 新增 App 私有原生狀態檔 \`droidpy_ide_state.json\` 雙重持久化與 \`onPause()\` 即時刷寫，確保退出或滑掉重開完整保留所有檔案與設定。
- 新增 \`android:requestLegacyExternalStorage="true"\`、完整 \`/sdcard\` 權限偵測、\`/sdcard/*\` API 與「Android 手機內部儲存空間管理」介面，可實際瀏覽、建立資料夾與讀寫 \`/storage/emulated/0\`。
- 修正 Termux Python \`PYTHONHOME\` 與內建原生 \`droid.py\`（支援 \`import droid\` 與 \`/droid-action\`），並強化 \`POST /stop\` 程序樹終止與前端 \`AbortController\`，確保「停止執行」立即解除並恢復「執行程式」按鈕。

## [1.2.3] - 2026-11-21
- 修復獨立 APK \`EmbeddedTermuxBridge.kt\` HTTP \`Content-Length\` 位元組長度錯判導致含中文註解的腳本永久卡死的問題（改用位元組流讀取並正確解碼 UTF-8）。
- 修復 APK 串流輸出在雙位元組/三位元組 UTF-8 邊界截斷產生亂碼的問題（改用 \`InputStreamReader\` 字元串流解碼）。
- 修復 \`MainActivity.kt\` 外部 \`https://\` 連結誤在 IDE WebView 內開啟及下載檔名未跳脫之異常，並補強 Bootstrap 完整解壓檢查與 \`pkg\` 金鑰信任選項。
`;

  zip.file('README.md', githubApkReadme);
  zip.file('README_GITHUB_APK.md', githubApkReadme);
  zip.file('CHANGELOG.md', changelogContent);

  return zip.generateAsync({ type: 'blob' });
}
