# MacBook setup for the Android part

Goal: Android Studio + two Android Automotive emulators (**wide** and **portrait**), Claude Code in the terminal, the repo on GitHub.
Time: ~1 hour, most of it downloads (~15 GB free disk needed).

Assumes an **Apple Silicon** Mac (M1–M4). On an Intel Mac pick the **x86_64** images wherever this says arm64.
Check: Apple menu → *About This Mac* → Chip.

---

## 1. Command-line basics (10 min)

Open **Terminal**.

```bash
# Homebrew (skip if `brew -v` works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# follow the 2 "Next steps" lines it prints (adds brew to your PATH), then:

brew install git gh node
git --version && gh --version && node -v    # node must be 18+

# Claude Code
curl -fsSL https://claude.ai/install.sh | bash
claude --version
```

Git identity (once):
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"    # the e-mail of your GitHub account
```

## 2. Android Studio first start (15 min + downloads)

1. Open Android Studio → **Setup Wizard** → *Standard* install type → accept the licences → Finish. It downloads the SDK, platform-tools and the emulator.
2. Skip importing settings and skip creating a project.
3. If the wizard was already dismissed: **More Actions → SDK Manager** on the welcome screen.

## 3. SDK packages

**More Actions → SDK Manager** (or *Android Studio → Settings → Languages & Frameworks → Android SDK*).

**SDK Platforms** tab → tick **Show Package Details** (bottom right):
- **Android 15 (API 35)**: *Android SDK Platform 35* and **Android Automotive with Google APIs arm64-v8a System Image** (API 35-ext15)
- *Alternative if the 35 image misbehaves:* **Android 14 (API 34)** → *Android Automotive with Google APIs arm64-v8a System Image* (API 34-ext9)

> Take **"Google APIs"**, not "Google Play Store": only images without Play Store accept **custom hardware profiles**, and we need custom display sizes.

**SDK Tools** tab → make sure these are ticked:
- Android SDK Build-Tools (latest)
- Android SDK Platform-Tools
- Android Emulator
- Android SDK Command-line Tools (latest)

**Apply** → wait for the downloads.

## 4. Environment variables

```bash
cat >> ~/.zshrc <<'EOF'

# Android
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
EOF
source ~/.zshrc

adb version && emulator -version | head -1 && java -version
```

`JAVA_HOME` points at the JDK bundled with Android Studio, so `./gradlew` in the terminal (used by Claude Code) uses the same Java as the IDE. In Android Studio: *Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK* = **jbr-21** (the bundled one; version number may differ).

## 5. Two emulators

Our displays: **wide** (content 1840 × 960 + header 132 → app area 1840 × 1092) and **portrait** (full display **1400 × 1840**, app area 1400 × 1532). Both at **160 dpi** so that **1 px = 1 dp** and the Figma numbers can be used 1:1.

### 5.1 Hardware profiles
**More Actions → Virtual Device Manager → + (Create Virtual Device) → New Hardware Profile**

| Field | Wide | Portrait |
|---|---|---|
| Device Name | `Digiteq Wide 1920x1200` | `Digiteq Portrait 1400x1840` |
| Device Type | **Android Automotive** | **Android Automotive** |
| Screen size | **14.15"** | **14.45"** |
| Resolution | **1920 × 1200** | **1400 × 1840** |
| RAM | 4096 MB | 4096 MB |
| Input | Has hardware buttons: off, keyboard: on | same |
| Supported orientations | Landscape | Portrait |
| Cameras / sensors | off | off |

The diagonal sizes are chosen so both come out at **160 dpi (mdpi)**. Tip: you can also select *Automotive Large Portrait* and **Clone Device…** and just edit the values.

(The wide full-display size is still a [PLACEHOLDER] in the rules; 1920 × 1200 leaves room for the system bars around our 1840 × 1092 app area. Adjust once we know the real value.)

### 5.2 Virtual devices
For each profile: select it → **Next** → system image **API 35 Automotive with Google APIs (arm64)** → Next →
- AVD name: `Wide_1920x1200` / `Portrait_1400x1840` (Claude Code uses these names)
- *Show Advanced Settings*: Graphics **Hardware**, Internal storage 8 GB, Boot option **Cold boot**
- Finish.

### 5.3 First start and check
Start `Wide_1920x1200` with ▶ in Device Manager (first boot takes 1–3 min). Then in Terminal:

```bash
emulator -list-avds                 # both names listed
adb devices                         # emulator-5554   device
adb shell wm size                   # Physical size: 1920x1200
adb shell wm density                # Physical density: 160
```

Repeat with `Portrait_1400x1840` (expect 1400x1840, 160).

**If the density is not 160** (or the portrait AVD won't boot properly): keep the one that works and force the values:
```bash
adb shell wm size 1400x1840 && adb shell wm density 160    # reset: wm size reset; wm density reset
```

**Car must be parked:** the emulator starts in gear P. Normal apps are hidden while "driving". If our app disappears: emulator side bar **⋯ (Extended controls) → Car data / Car sensor data → Gear = P, speed 0**.

Running both emulators at once works on 16 GB RAM; on 8 GB run one at a time.

## 6. GitHub repository

On the MacBook (unzip the repo folder first, e.g. to `~/dev/digiteq-reshape-poc`):

```bash
cd ~/dev/digiteq-reshape-poc
gh auth login                       # GitHub.com → HTTPS → login with browser
git init -b main
git add . && git commit -m "Figma reshape tools, rules, docs"
gh repo create digiteq-reshape-poc --private --source . --push
```

Private repo, invented content only – still, don't add Škoda files here.
On the work PC (Figma part): `gh repo clone digiteq-reshape-poc` (or GitHub Desktop), then pull/push as usual.

## 7. Start Claude Code

```bash
cd ~/dev/digiteq-reshape-poc
claude
```
Log in with your Claude account the first time. It reads `CLAUDE.md` automatically. First prompt, for example:

> Read CLAUDE.md and docs/android-app-spec.md. Check my environment (adb, emulator AVDs, java), then do phase 2a step 1: create the TipsApp project and show me S1 Home on the wide emulator (wide layouts only for now).

Useful: keep Android Studio open on `android/TipsApp` at the same time – Claude Code edits files, Studio shows the layout preview and runs the app; both work on the same folder.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `adb: command not found` | `source ~/.zshrc`; check `ANDROID_HOME` path exists |
| No Automotive images in SDK Manager | Tick **Show Package Details** on the *SDK Platforms* tab |
| Custom profile not offered for an image | You picked a *Play Store* image → use *Google APIs* |
| Emulator black / very slow | Graphics = Hardware; close other emulators; cold boot from Device Manager (▾ → Cold Boot Now) |
| App not in the launcher / closes | Car not parked (see 5.3); or app not launchable – check `adb shell am start -n cz.digiteq.tips/.HomeActivity` |
| Gradle: "Unsupported Java" | Gradle JDK = bundled jbr (section 4) |
| `gradlew: Permission denied` | `chmod +x android/TipsApp/gradlew` |

Source: [Android Developers – Test using the Android Automotive OS emulator](https://developer.android.com/training/cars/testing/emulator)
