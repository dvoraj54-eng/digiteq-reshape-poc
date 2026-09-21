#!/usr/bin/env bash
# One command for the demo: the layout-rule tests on both displays + a screenshot of every screen.
#
#   android/run-tests.sh              # both displays (wide, then portrait)
#   android/run-tests.sh wide         # only Wide_1920x1200
#   android/run-tests.sh portrait     # only Portrait_1400x1840
#   HEADLESS=1 android/run-tests.sh   # emulator without a window
#
# Per display: stop any running emulator -> boot the AVD -> connectedDebugAndroidTest ->
# screenshot of S1/S2/S3 -> shut the emulator down. Only one emulator runs at a time (16 GB Mac).
# Results: android/test-reports/<timestamp>/  (test XML, Gradle log, PNGs) and a summary at the end.
# Exit code 0 = every test passed on every display that was run.

set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
app="$here/TipsApp"
stamp="$(date +%Y%m%d-%H%M%S)"
out="$here/test-reports/$stamp"
mkdir -p "$out"

sdk="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
emulator_bin="$(command -v emulator || echo "$sdk/emulator/emulator")"

case "${1:-both}" in
  wide)     avds=("Wide_1920x1200") ;;
  portrait) avds=("Portrait_1400x1840") ;;
  both)     avds=("Wide_1920x1200" "Portrait_1400x1840") ;;
  *) echo "usage: $0 [wide|portrait|both]"; exit 2 ;;
esac

log() { printf '\n== %s\n' "$*"; }

stop_emulator() {
  adb emu kill >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    [ -z "$(adb devices | tail -n +2 | grep -v '^$')" ] && return 0
    sleep 2
  done
}

boot_emulator() {
  local avd="$1"
  # shellcheck disable=SC2086
  "$emulator_bin" -avd "$avd" -no-snapshot-save -no-audio ${HEADLESS:+-no-window} >"$out/$avd.emulator.log" 2>&1 &
  adb wait-for-device
  for _ in $(seq 1 90); do
    [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 5
  done
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] || return 1
  adb root >/dev/null 2>&1; sleep 3; adb wait-for-device   # lets `am start` open non-exported activities
  for s in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb shell settings put global "$s" 0 >/dev/null 2>&1 || true
  done
  sleep 5
}

screenshots() {
  local avd="$1" display
  # The automotive emulator has two displays; the first one is the main display.
  display="$(adb shell dumpsys SurfaceFlinger --display-id 2>/dev/null | head -1 | awk '{print $2}')"
  for act in HomeActivity CategoryActivity TipDetailActivity; do
    adb shell am force-stop cz.digiteq.tips
    adb shell am start -n "cz.digiteq.tips/.$act" >/dev/null 2>&1
    sleep 3
    adb exec-out screencap -d "$display" -p >"$out/$avd.${act%Activity}.png"
  done
  adb shell am force-stop cz.digiteq.tips
}

overall=0
for avd in "${avds[@]}"; do
  log "$avd: booting"
  stop_emulator
  if ! boot_emulator "$avd"; then
    echo "!! $avd did not boot (see $out/$avd.emulator.log)"; overall=1; continue
  fi
  log "$avd: layout-rule tests"
  ( cd "$app" && ./gradlew connectedDebugAndroidTest --console=plain >"$out/$avd.gradle.log" 2>&1 )
  rc=$?; [ $rc -ne 0 ] && overall=1
  find "$app/app/build/outputs/androidTest-results/connected" -name 'TEST-*.xml' -exec cp {} "$out/$avd.tests.xml" \; 2>/dev/null
  [ -d "$app/app/build/reports/androidTests/connected" ] && cp -R "$app/app/build/reports/androidTests/connected" "$out/$avd.html-report" 2>/dev/null
  log "$avd: screenshots"
  screenshots "$avd"
  stop_emulator
done

log "Summary  ($out)"
python3 - "$out" "${avds[@]}" <<'PY' || overall=1
import os, sys, xml.etree.ElementTree as ET
out, avds = sys.argv[1], sys.argv[2:]
bad = 0
for avd in avds:
    f = os.path.join(out, avd + ".tests.xml")
    if not os.path.exists(f):
        print(f"  {avd:20} NO RESULT (see {avd}.gradle.log)"); bad += 1; continue
    r = ET.parse(f).getroot()
    n, fail = int(r.get("tests")), int(r.get("failures")) + int(r.get("errors"))
    print(f"  {avd:20} {n - fail}/{n} passed" + ("" if not fail else "   <-- FAILED"))
    for tc in r.iter("testcase"):
        fl = tc.find("failure") if tc.find("failure") is not None else tc.find("error")
        if fl is None: continue
        bad += 1
        print(f"      x {tc.get('classname').split('.')[-1]}.{tc.get('name')}")
        for line in [l.strip() for l in (fl.text or "").split("\n") if l.strip().startswith("-")][:3]:
            print(f"          {line[:140]}")
print(f"\n  screenshots + logs: {out}")
sys.exit(1 if bad else 0)
PY
exit $overall
