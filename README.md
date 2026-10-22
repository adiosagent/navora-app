# Navora — native apps (Android + iOS)

The web app at navora.my wrapped in a Capacitor native shell. The app loads **https://navora.my** inside a native
WebView (so every update you upload to Hostinger reaches app users instantly) and adds native plugins the browser
cannot provide: native speech recognition (no Chrome beep, and "Hello Navora" works on **iPhone** too), native
text-to-speech, GPS that keeps running with the screen off, keep-awake, haptics, share sheet, push notifications,
splash screen and status bar. A copy of the web app is bundled in `www/` as an offline fallback.

## What is in this folder

```
capacitor.config.json   app id my.navora.app, loads https://navora.my, plugin settings
www/                    bundled copy of the web app (fallback; API points at navora.my)
assets/                 icon + splash sources generated from your logo
android/                Android Studio project (icons, splash, permissions already set)
ios/                    Xcode project (icons, splash, Info.plist usage strings already set)
.github/workflows/      GitHub Actions: builds the APK / AAB and the iOS archive in the cloud
```

Requirements already wired into the web app (`navora/native.js`, loaded by `index.html`): when the page runs inside
the app it uses the native plugins; in a normal browser nothing changes.

---

## Option A — build in the cloud (no Android Studio needed)

1. Create a GitHub repository (private is fine) and push this folder:
   ```
   cd navora-app
   git init && git add -A && git commit -m "Navora app" && git branch -M main
   git remote add origin https://github.com/<you>/navora-app.git && git push -u origin main
   ```
2. On GitHub open **Actions → Build Navora apps → Run workflow**. About 6–8 minutes later download the artifact
   **navora-android** → `app-debug.apk`. Send that APK to any Android phone (WhatsApp, Drive) → open → install
   (allow "unknown sources" once). This is enough for testing and for sharing with early users.
3. For **Google Play** you need a signed release bundle (AAB). Create a keystore once:
   ```
   keytool -genkey -v -keystore navora.keystore -alias navora -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 navora.keystore   # macOS: base64 -i navora.keystore
   ```
   Add GitHub secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
   run the workflow again, and upload the `.aab` from the artifact to Play Console. **Keep the keystore safe — losing it
   means you can never update the app on Play.**

## Option B — build locally

**Android** (Windows/Mac/Linux): install Android Studio → `npm install --legacy-peer-deps` → `npx cap sync android`
→ `npx cap open android` → Build → Build APK(s), or Run on a connected phone.

**iOS** (Mac only): install Xcode + CocoaPods → `npm install --legacy-peer-deps` → `npx cap sync ios`
→ `npx cap open ios` → select your Team under Signing → Run on your iPhone, or Product → Archive → Distribute
(TestFlight / App Store). An Apple Developer account (USD 99/year) is required to put it on a real iPhone or
TestFlight.

## Publishing checklist

**Google Play Console** (one-time USD 25): app name *Navora*, category Maps & Navigation, content rating, privacy
policy URL `https://navora.my/manual.html#privacy`, data-safety form (location: collected for app functionality,
not shared, not stored; no user IDs), screenshots (phone, 1080×1920 or similar), feature graphic 1024×500,
upload the signed AAB → internal testing first → production.

**App Store Connect**: bundle id `my.navora.app`, category Navigation, privacy nutrition labels (Location — app
functionality, not linked to identity; no tracking), review notes explaining the Hello Navora microphone use and that
the app loads navora.my content. Apple requires the app to work as an app (it does: native location, voice, push).

## Updating the app

- Web content (map, features, text): just upload to navora.my — app users get it on next launch, no store update.
- Native change (new plugin, icon, permission): bump `versionCode` / `versionName` in `android/app/build.gradle`
  and the version in Xcode, run `npx cap sync`, rebuild, upload to the stores.

## Phase 3 (not in this build)

- **Android Auto / CarPlay**: Google and Apple only allow navigation-category car apps built with their native
  templates (Android Car App Library, CarPlay Navigation entitlement, which Apple grants on application). This needs a
  native navigation UI, not a WebView, and is the next major project after the store launch.
- Background wake-word while the app is closed (needs a foreground service on Android and is not permitted on iOS).
