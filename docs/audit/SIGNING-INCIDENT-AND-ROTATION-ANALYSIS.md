# DroidPy APK signing incident and rotation analysis

> Status: confirmed production signing-key exposure; no key rotation performed.
> Evidence baseline: v1.2.18 GitHub Actions run `45444107279`, build job `138623421863`.
> Target devices: Android 11 phone and Android 13 tablet; product supports Android 10+ and sideloaded APK distribution (not Google Play).

## 1. Incident confirmation

The public repository tracks both:
- `signing/droidpy-debug.p12` (PKCS#12 keystore file).
- `src/services/androidSigningAsset.ts` (Base64-encoded PKCS#12 material and certificate fingerprint).

The v1.2.18 build job log explicitly shows the workflow took the fallback branch that copied `signing/droidpy-debug.p12` into the Android build and used the fixed DroidPy consistency key. The same successful job ran `apksigner verify --verbose --print-certs`; its V2 signer SHA-256 certificate digest matched the fingerprint embedded in the public source asset. This confirms the public private-key material is the production signer identity, not merely an unused debug key.

Evidence:
- Workflow run: https://github.com/sumengjin/DroidPy/actions/runs/45444107279
- Release: https://github.com/sumengjin/DroidPy/releases/tag/v1.2.18

This key must be treated as compromised. Removing the file from the latest tree or rewriting history does not make the exposed private key secret again.

## 2. Android signing rotation behavior relevant to supported devices

Official Android documentation describes the relevant schemes:

- APK Signature Scheme v3 supports proof-of-rotation, introduced with Android 9 (API 28). The lineage is a chain in which each previous signing certificate signs the next certificate. Android's verifier checks that the lineage is valid.
- APK Signature Scheme v3.1 is supported on Android 13 (API 33) and later. With the default rotation behavior, Android 13+ uses the rotated signer from the v3.1 block, while older devices ignore v3.1 and continue using the original signer in the v3 block.
- The official `apksigner` option `--rotation-min-sdk-version` can target rotation to a lower API level. The Android documentation specifically warns that key rotation is not recommended on Android 12 (API 31) and earlier; the tooling notes special handling when a rotated signer has already been used on Android 12L or lower.

Official references:
- APK Signature Scheme v3: https://source.android.com/docs/security/features/apksigning/v3
- APK Signature Scheme v3.1: https://source.android.com/docs/security/features/apksigning/v3-1
- apksigner options and rotation: https://developer.android.com/tools/apksigner
- App signing and upgrade compatibility: https://developer.android.com/studio/publish/app-signing

## 3. Device compatibility implications

| Device | Platform behavior to plan for | Required validation |
|---|---|---|
| Android 10 (API 29) | v3 can verify proof-of-rotation; v3.1 is ignored | Upgrade directly from installed v1.2.18 using candidate lineage APK; verify app data and private Termux files remain |
| Android 11 (API 30) | v3 can verify proof-of-rotation; v3.1 is ignored | Test the exact rotation-minimum-SDK choice; do not assume Android 13 behavior applies |
| Android 13 (API 33) | v3.1 can use the rotated signer while retaining the original signer for older platforms | Test direct upgrade from v1.2.18 and subsequent update signed by new key |

The v1.2.18 build log reported a V2 signer. The next candidate must deliberately include the appropriate v3/v3.1 lineage metadata and be verified with `apksigner verify --verbose --print-certs` against every supported SDK range.

The default `apksigner` rotation behavior uses the rotated signer in the v3.1 block on Android 13+ and retains the original signer in the v3 block for Android 9 through Android 12L. Therefore, default rotation would **not** move the Android 11 device off the compromised signer. The tool exposes `--rotation-min-sdk-version 28` to make the rotated signer apply from Android 9/API 28, but AOSP explicitly says key rotation is not recommended on Android 12 and earlier. This option is only a candidate for device testing, not an approved production setting.

For the candidate lineage, preserve the `installed-data` capability so existing private app data can migrate, but do not grant `rollback` capability to the compromised old key. Android's own documentation notes that rollback capability allows the previous key to authorize a rollback and undermines rotation. The lineage must be inspected with the apksigner lineage tooling and tested against an actual installed v1.2.18 APK before use.


## 4. Hard safety rules

1. Do not replace the current signer on the production branch until a candidate APK has been installed as an update over an actual v1.2.18 install on Android 11 and Android 13.
2. Do not assume the default v3.1 behavior protects Android 10/11. Under default v3.1 behavior those devices continue to see the old signer in the v3 block.
3. Do not claim that proof-of-rotation alone restores full trust after the old private key was exposed. An attacker who possesses the old key may be able to create competing signed artifacts/lineages; assess rollback and capability flags explicitly.
4. The lineage must preserve the installed-data capability needed for app data migration. The rollback capability must not be enabled casually: the Android signing tools warn that permitting rollback to an older signer can undermine the security benefit of rotation.
5. Preserve package ID, minSdk 24, Android 10+ private-storage behavior, and existing `usr/`, Python package, workspace and backup data.
6. Keep automatic APK build and GitHub Release publishing, but do not silently fall back to a public source-controlled private key.
7. GitHub Actions Secrets cannot be read or written by the currently available GitHub connector. No claim may be made that signing secrets exist or are configured. A missing protected signing secret must fail closed rather than use a public fallback.
8. No key was rotated, removed, or replaced during this analysis; no new APK was published.

## 5. Containment plan to validate before implementation

### A. Immediate exposure containment
- Remove the private keystore and Base64 private-key asset from all future source trees and generated project ZIPs.
- Review the entire Git history, all branches, artifacts, Release uploads and workflow logs for duplicate copies or passwords. Treat historic copies as compromised even after cleanup.
- Replace public-source fallback signing with protected CI-only signing. Since the connector cannot set repository Actions Secrets, this requires a separately authorized secure secret-provisioning path; do not embed the key in a public commit to work around that limitation.
- Restrict Release creation to trusted protected refs and minimum workflow permissions.

### B. Rotation candidate (not yet approved)
- Create a new private key in a protected signing environment.
- Generate a signing certificate lineage from the existing production signer to the new signer.
- Build test APKs using explicit v3/v3.1 rotation settings and explicit capability flags; inspect the resulting lineage and signer selection for API 29, 30 and 33.
- Install v1.2.18 first, then install the candidate as an in-place update on Android 11 and Android 13. Confirm package ID, app data, files under app-private storage, Termux runtime, Python packages, workspace, backups, permissions and updater behavior.
- Test the next subsequent update with the new key and test rollback policy without permitting unsafe downgrade.
- Only after all tests pass, stage the production release. If Android 11 cannot safely rotate, document that the compromised signer remains trusted on that platform and do not conceal the residual risk.

### C. Release gate
A release must fail if:
- protected signing material is missing or malformed;
- signer/lineage verification fails;
- package ID or versionCode is inconsistent;
- APK cannot be verified for all supported SDK versions;
- expected lineage does not match the approved candidate;
- release asset digest is missing or inconsistent.

## 6. Current decision

**Rotation is blocked pending a tested Android 10+ update path and a secure signing-secret provisioning path.** The old private key is confirmed compromised; preserving the existing key does not make it safe. No production key change is authorized by this analysis alone.
