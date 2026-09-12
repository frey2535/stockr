#!/usr/bin/env bash
set -euo pipefail

# Builds a Play Store AAB and/or a sideload APK.
# Usage: scripts/build-android.sh [apk|bundle|all]
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-all}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/android-sdk}}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  bash "$ROOT/scripts/install-android-sdk.sh"
fi

if [[ ! -f "$ROOT/android/keystore/stockr-upload.jks" ]]; then
  bash "$ROOT/scripts/create-keystore.sh"
fi

printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ROOT/android/local.properties"

cd "$ROOT"
npx cap sync android

cd "$ROOT/android"
chmod +x ./gradlew

DIST="$ROOT/dist/android"
PUBLIC_DL="$ROOT/public/downloads"
mkdir -p "$DIST" "$PUBLIC_DL"

build_apk() {
  ./gradlew assembleRelease --no-daemon
  local out
  out="$(find "$ROOT/android/app/build/outputs/apk/release" -name '*.apk' | head -n 1)"
  cp "$out" "$DIST/stockr-release.apk"
  cp "$out" "$PUBLIC_DL/stockr.apk"
  echo "Sideload APK: $DIST/stockr-release.apk"
  echo "Website copy: $PUBLIC_DL/stockr.apk"
}

build_bundle() {
  ./gradlew bundleRelease --no-daemon
  local out
  out="$(find "$ROOT/android/app/build/outputs/bundle/release" -name '*.aab' | head -n 1)"
  cp "$out" "$DIST/stockr-release.aab"
  echo "Play Store AAB: $DIST/stockr-release.aab"
}

case "$MODE" in
  apk) build_apk ;;
  bundle|aab) build_bundle ;;
  all)
    build_apk
    build_bundle
    ;;
  *)
    echo "Usage: $0 [apk|bundle|all]" >&2
    exit 1
    ;;
esac
