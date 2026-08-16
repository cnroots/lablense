#!/usr/bin/env bash
#
# run-on-device.sh — build, install and run the LabLens mobile app on a phone
# over adb (USB or WiFi). Handles JDK/SDK detection, adb wireless pairing and
# the Expo dev-client build, so a one-line command gets you onto the device.
#
# Usage:
#   ./scripts/run-on-device.sh                 build + install + start Metro
#   ./scripts/run-on-device.sh --ip 10.0.0.42  connect to a specific phone IP
#   ./scripts/run-on-device.sh --start-only    app already installed: just start Metro
#   ./scripts/run-on-device.sh --host lan      start Metro reachable on your LAN
#
# Environment overrides:
#   ANDROID_HOME / ANDROID_SDK_ROOT   Android SDK location (default ~/Android/Sdk)
#   JAVA_HOME                         JDK 17+ (default: newest sdkman JDK >= 17)
#   ADB_PORT                          adb tcpip port (default 5555)

set -euo pipefail

cd "$(dirname "$0")/.."   # apps/mobile

IP=""
START_ONLY=0
HOST_MODE="localhost"
ADB_PORT="${ADB_PORT:-5555}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip) IP="$2"; shift 2 ;;
    --start-only) START_ONLY=1; shift ;;
    --host) HOST_MODE="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

info() { printf '\033[1;34m[i]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[w]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[x]\033[0m %s\n' "$*"; exit 1; }

# ---------------------------------------------------------------------------
# 1 · Java 17+ (Gradle for RN 0.86 requires it)
# ---------------------------------------------------------------------------
jdk_major() {  # $1 = path to java binary → prints major version (or empty)
  local out
  out="$("$1" -version 2>&1 | head -1)"
  local v
  v="$(printf '%s\n' "$out" | sed -E 's/.*"([0-9]+)(\.[0-9]+)?.*/\1/')"
  [[ "$v" =~ ^[0-9]+$ ]] && printf '%s' "$v" || true
}

setup_java() {
  # 1) Explicit JAVA_HOME — but only if it's actually 17+.
  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    local hv
    hv="$(jdk_major "$JAVA_HOME/bin/java")"
    if [[ -n "$hv" && "$hv" -ge 17 ]]; then
      info "Using JAVA_HOME=$JAVA_HOME ($("$JAVA_HOME/bin/java" -version 2>&1 | head -1))"
      export PATH="$JAVA_HOME/bin:$PATH"
      return 0
    fi
    warn "JAVA_HOME=$JAVA_HOME is JDK $hv (< 17); ignoring and looking for a newer JDK."
  fi

  # 2) Newest sdkman JDK >= 17.
  local sdkman_root="${SDKMAN_CANDIDATES_DIR:-$HOME/.sdkman/candidates}"
  local best="" best_ver=0 dir
  for dir in "$sdkman_root"/java/*/; do
    [[ -x "$dir/bin/java" ]] || continue
    local ver
    ver="$(jdk_major "$dir/bin/java")"
    [[ -n "$ver" ]] || continue
    if (( ver >= 17 && ver > best_ver )); then
      best_ver="$ver"
      best="${dir%/}"
    fi
  done

  if [[ -n "$best" ]]; then
    export JAVA_HOME="$best"
    export PATH="$best/bin:$PATH"
    info "Selected JDK: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
    return 0
  fi

  # 3) System java, if it's 17+.
  if command -v java >/dev/null 2>&1; then
    local sysver
    sysver="$(jdk_major "$(command -v java)")"
    if [[ -n "$sysver" && "$sysver" -ge 17 ]]; then
      info "Using system JDK $sysver"
      return 0
    fi
  fi

  fail "No JDK 17+ found. Install one (e.g. 'sdk install java 21.0.12-tem') and retry."
}

# ---------------------------------------------------------------------------
# 2 · Android SDK + platform-tools (adb)
# ---------------------------------------------------------------------------
setup_sdk() {
  export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
  if [[ ! -d "$ANDROID_HOME" ]]; then
    fail "Android SDK not found at $ANDROID_HOME. Set ANDROID_HOME."
  fi
  if [[ -x "$ANDROID_HOME/platform-tools/adb" ]]; then
    export PATH="$ANDROID_HOME/platform-tools:$PATH"
  elif ! command -v adb >/dev/null 2>&1; then
    fail "adb not found. Install platform-tools in the SDK."
  fi

  if [[ -z "$(ls -A "$ANDROID_HOME/ndk" 2>/dev/null)" || -z "$(ls -A "$ANDROID_HOME/cmake" 2>/dev/null)" ]]; then
    warn "NDK and/or CMake missing. onnxruntime-react-native compiles C++ and needs both."
    warn "Install them via Android Studio → SDK Manager → SDK Tools (NDK + CMake)."
  fi

  info "ANDROID_HOME=$ANDROID_HOME"
}

# ---------------------------------------------------------------------------
# 3 · adb device (USB or WiFi)
# ---------------------------------------------------------------------------
device_connected() {
  adb devices | awk 'NR>1 && $2=="device" {found=1} END {exit !found}'
}

connect_wifi() {
  if device_connected; then
    info "Device already connected."
    return 0
  fi

  if [[ -z "$IP" ]]; then
    # Try to guess the phone IP from the adb 'host' output, else ask.
    local guess
    guess="$(ip -4 route get 1.1.1.1 2>/dev/null | grep -oE 'src [0-9.]+' | awk '{print $2}' || true)"
    read -r -p "Phone IP address (e.g. ${guess%.*}.42): " IP
    [[ -z "$IP" ]] && fail "No IP provided."
  fi

  info "Connecting to $IP:$ADB_PORT ..."
  if adb connect "$IP:$ADB_PORT" >/dev/null 2>&1; then
    info "Connected via tcpip. (If it stays 'unauthorized', accept the prompt on the phone.)"
  else
    warn "adb connect failed. On Android 11+, enable Developer options → Wireless debugging"
    warn "and run:  adb pair $IP:<pairing-port>   then   adb connect $IP:<connection-port>"
    warn "For older devices, plug in USB once and run:  adb tcpip $ADB_PORT"
    exit 1
  fi
}

ensure_reverse() {
  adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 \
    && info "Metro port 8081 reverse-tunnelled to the phone." \
    || warn "Could not set adb reverse (non-fatal)."
}

# ---------------------------------------------------------------------------
# 4 · Run
# ---------------------------------------------------------------------------
main() {
  setup_java
  setup_sdk
  connect_wifi

  adb devices
  ensure_reverse

  if [[ "$START_ONLY" == "1" ]]; then
    info "Starting Metro only (app must already be installed)."
    exec npx expo start --dev-client --host "$HOST_MODE"
  fi

  info "Building dev client and installing on device (first build is slow) ..."
  exec env EXPO_USE_COMMUNITY_AUTOLINKING=1 npx expo run:android
}

main "$@"
