# AfriHex Error Reporting

Dated log of production-impacting issues and their resolutions.

---

## 2026-09-27 — Android launch shows permanent blank screen (react-native-maps `mapPadding` NPE)

**Status:** Resolved

**Environment**

- Platform: Android standalone release build (EAS `preview` profile APK)
- Expo SDK 57, React Native 0.86.3, New Architecture (Fabric)
- `react-native-maps`: 1.27.2 (affected) → 1.29.8 (fixed)

**Symptom**

- The app opened to a blank dark screen on Android release builds and never rendered. The process stayed alive — no crash, no instant close.
- Expo Go rendered the identical JS bundle correctly, so the defect was standalone/native path only.
- No Sentry crash event fired, and the app's JS error boundary was never triggered.

**Root cause**

`react-native-maps@1.27.2` applies the `mapPadding` prop during the map's first **native Fabric mount**, before the underlying `GoogleMap` object exists. `MapView.applyBaseMapPadding()` (`MapView.java:1506`) then called `GoogleMap.setPadding(...)` on a null object reference. Because the throw happens inside the native mounting engine (not the JS render path), it aborts the first-frame mount commit, the React runtime is torn down, and the splash/blank screen persists.

The exact stack trace captured from device logs:

```
java.lang.NullPointerException: Attempt to invoke virtual method
  'void com.google.android.gms.maps.GoogleMap.setPadding(int,int,int,int)' on a null object reference
    at com.rnmaps.maps.MapView.applyBaseMapPadding(MapView.java:1506)
    at com.rnmaps.fabric.MapViewManager.setMapPadding(MapViewManager.java:315)
    at com.rnmaps.fabric.MapViewManager.setMapPadding(MapViewManager.java:43)
    at com.facebook.react.viewmanagers.RNMapsMapViewManagerDelegate.setProperty(...)
    at com.facebook.react.uimanager.ViewManager.updateProperties(ViewManager.java:102)
    at com.facebook.react.fabric.mounting.SurfaceMountingManager.updateProps(SurfaceMountingManager.kt:683)
```

App screens that pass `mapPadding` at mount (and were affected): `InteractiveMap` (Search screen), `RouteMap` (Navigation).

**Why diagnosis was slow**

- The earlier, visible maps failure (missing key abort) was already fixed, leaving this second, silent maps bug behind a blank screen.
- Flipping the app's JS "use static map fallback" gate off did not help, because the failure is in the native mounting path, not in JS. A proposed "maps-off diagnostic" build never actually ran maps-free: a project-level EAS secret for `GOOGLE_MAPS_ANDROID_API_KEY` overrode the build profile's placeholder with the real key.
- Nothing crashed: the process survived with its React runtime torn down, so native crash reporting and the JS error boundary both stayed silent.
- Expo Go worked fine, which kept pointing the investigation away from the native maps code.

**Resolution**

Upgraded `react-native-maps` from 1.27.2 to **1.29.8**, which ships the upstream fix: `applyBaseMapPadding` now checks `map == null` (or view not laid out) and **defers** the padding until the map is ready instead of calling `setPadding` on a null object.

```java
if (map == null || super.getHeight() <= 0 || super.getWidth() <= 0) {
    baseLeftMapPadding = left; /* ... */ setPaddingDeferred = true;
    return; // defer — no crash
}
```

Kept pinned with `expo.install.exclude: ["react-native-maps"]` in `package.json` so a future `expo install --fix` cannot silently roll it back.

**Validation**

- `npx tsc --noEmit` — clean.
- Rebuilt via EAS `preview` profile; verified on an Android 35 emulator (logcat + UI hierarchy dump):
  - `.MainActivity` reached `Displayed` (previously never displayed).
  - Zero `applyBaseMapPadding` / `GoogleMap.setPadding` NPEs.
  - Full Search screen rendered (search bar, tabs, bottom nav present in UI dump).
  - Google Maps SDK initialized in-process; no FATAL; no JS errors.
- Fixed preview build: `99dc3cc7-5fa2-469c-a9a4-9c0a8f5a752b` — https://expo.dev/accounts/abdulmalikgh/projects/afrihex/builds/99dc3cc7-5fa2-469c-a9a4-9c0a8f5a752b

**Files changed for this fix**

- `package.json` / `package-lock.json` — `react-native-maps@1.29.8` + `expo.install.exclude`
- `eas.json` — preview profile maps env restored to the real key / `EXPO_PUBLIC_MAPS_CONFIGURED=true` (matching production), removing the temporary diagnostic placeholder

**Follow-ups**

- Confirm the fixed build on a real Android device before running the production build.
- Production profile currently outputs an AAB (Play Store format); add `buildType: "apk"` if an APK for direct distribution is also needed.