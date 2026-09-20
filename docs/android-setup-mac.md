# MacBook setup for the Android part

Goal: Android Studio + two Android Automotive emulators (**wide** and **portrait**), Claude Code in the terminal, the repo on GitHub.
Time: ~1 hour, most of it downloads (~15 GB free disk needed).

Jan's MacBook: **Intel (x86_64), macOS 15.7, 16 GB RAM.** The guide is written for that; Apple Silicon differences are noted where they matter.
Check on any Mac: `uname -m` → `x86_64` = Intel, `arm64` = Apple Silicon.

**Intel Mac in short:** emulator images **x86_64**, run **one emulator at a time**, Homebrew builds packages from source (slow – see §1).

---

## 1. Command-line basics (10 min)

Open **Terminal**.

```bash
# Homebrew (skip if `brew -v` works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# follow the 2 "Next steps" lines it prints (adds brew to your PATH), then:

brew install git gh
git --version && gh --version
```

**Node 18+:** on Intel Macs Homebrew has no ready-built packages any more and compiles from source (`./configure`, `make` in the output) – node + openssl can take 30+ minutes. Faster: install the **LTS .pkg** from [nodejs.org](https://nodejs.org) (2 minutes). (`brew install node` also works if you have the time; on Apple Silicon it's fast.)

A warning *"A newer Command Line Tools release is available"* is harmless. Update afterwards via *System Settings → General → Software Update*, or:
```bash
sudo rm -rf /Library/Developer/CommandLineTools
sudo xcode-select --install
```

```bash
node -v                                      # must be 18+

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
- **Android 15 (API 35)**: *Android SDK Platform 35* and **Android Automotive with Google APIs Intel x86_64 Atom System Image** (API 35-ext15)
- *Alternative if the 35 image misbehaves:* **Android 14 (API 34)** → *Android Automotive with Google APIs Intel x86_64 Atom System Image* (API 34-ext9)
- (Apple Silicon: the same images in **arm64-v8a**.)

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
For each profile: select it → **Next** → system image **API 35 Automotive with Google APIs (x86_64)** → Next →
- AVD name: `Wide_1920x1200` / `Portrait_1400x1840` (Claude Code uses these names)
- *Show Advanced Settings*: RAM **4096 MB**, Graphics **Hardware** (if the screen flickers or stays black: **Software**), Internal storage 8 GB, Boot option **Cold boot**
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

**Run one emulator at a time** (Intel, 16 GB): two automotive emulators + Android Studio + Gradle would make everything slow. Close one before starting the other (Device Manager ■, or `adb emu kill`).

## 6. GitHub repository

The repo already exists: **github.com/dvoraj54-eng/digiteq-reshape-poc** (created from the work PC). On the MacBook just clone it:

```bash
mkdir -p ~/dev && cd ~/dev
gh auth login                       # GitHub.com → HTTPS → login with browser
gh repo clone dvoraj54-eng/digiteq-reshape-poc
cd digiteq-reshape-poc
node figma/tests/simulate.js        # quick check: 27 passed, 0 failed
```

Both machines then work with `git pull` / `git push` as usual – pull before you start, push when you stop.
Invented content only – don't add Škoda files here (keep the repo private when not needed otherwise).

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
| Emulator black / very slow | Only one emulator running; try Graphics = Software (Intel); cold boot from Device Manager (▾ → Cold Boot Now) |
| `brew install` runs for ages (`make` output) | Normal on Intel Macs (built from source). For Node use the .pkg from nodejs.org |
| App not in the launcher / closes | Car not parked (see 5.3); or app not launchable – check `adb shell am start -n cz.digiteq.tips/.HomeActivity` |
| Gradle: "Unsupported Java" | Gradle JDK = bundled jbr (section 4) |
| `gradlew: Permission denied` | `chmod +x android/TipsApp/gradlew` |

Source: [Android Developers – Test using the Android Automotive OS emulator](https://developer.android.com/training/cars/testing/emulator)
