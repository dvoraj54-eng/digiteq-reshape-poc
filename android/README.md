# Android test app (Tips app)

`TipsApp/` – the Tips app from the Figma POC as an Android Automotive app (XML Views, Kotlin).
Spec: `docs/android-app-spec.md`. Mac setup: `docs/android-setup-mac.md`.

**Status:** phase 2a – wide layouts only (`res/layout/`). all three screens and the navigation between them are done (Home → Category → Tip detail → back).

## Build and run (from `android/TipsApp`)

```bash
emulator -avd Wide_1920x1200 -no-snapshot-save &     # wait for sys.boot_completed = 1
./gradlew installDebug
adb shell am start -n cz.digiteq.tips/.HomeActivity
```

**Screenshots:** the automotive emulator has two displays (main + cluster), so plain `adb exec-out screencap -p`
returns a warning instead of a PNG. Pass the id of the main display (`EMU_display_0`):

```bash
adb shell dumpsys SurfaceFlinger --display-id        # ids of the displays
adb exec-out screencap -d <id of EMU_display_0> -p > /tmp/shot.png
```

The app area is the display minus the 76 dp system bar on top (1920 × 1124 dp on the wide emulator).

## Third-party assets

- **Inter** font (SIL Open Font License 1.1, `licenses/Inter-OFL.txt`), static TTFs from the Inter 4.1 release.
- **Material Symbols** icons (Apache 2.0), `res/drawable/ic_*.xml`.

**Launching a screen directly:** `CategoryActivity` and later screens are not exported, so plain `adb shell am start`
is denied. Run `adb root` once (works on the Google APIs emulator images), then `am start -n cz.digiteq.tips/.CategoryActivity`.
