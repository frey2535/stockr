#!/usr/bin/env bash
set -euo pipefail

# Installs the Android command-line SDK (no Android Studio) for Play AAB / sideload APK builds.
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/android-sdk}}"
ZIP_URL="https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip"
ZIP_SHA="04453066b540409d975c676d781da1477479dde3761310f1a7eb92a1dfb15af7"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"

mkdir -p "$SDK_ROOT/cmdline-tools"
SDKMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"

if [[ ! -x "$SDKMANAGER" ]]; then
  tmp="$(mktemp -d)"
  echo "Downloading Android command-line tools…"
  curl -fsSL "$ZIP_URL" -o "$tmp/cmdline-tools.zip"
  echo "$ZIP_SHA  $tmp/cmdline-tools.zip" | sha256sum -c -
  unzip -q "$tmp/cmdline-tools.zip" -d "$tmp"
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mkdir -p "$SDK_ROOT/cmdline-tools"
  mv "$tmp/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -rf "$tmp"
fi

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"

mkdir -p "$SDK_ROOT/licenses"
printf '%s\n' "24333f8a63b6825ea9c5514f83c2829b004d1fee" > "$SDK_ROOT/licenses/android-sdk-license"
printf '%s\n' "84831b9409646161ce1d187d5adb8c9d" > "$SDK_ROOT/licenses/android-sdk-preview-license"

"$SDKMANAGER" --sdk_root="$SDK_ROOT" \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0"

if [[ -d "$(dirname "$0")/../android" ]]; then
  printf 'sdk.dir=%s\n' "$SDK_ROOT" > "$(dirname "$0")/../android/local.properties"
fi

echo "Android SDK ready at $SDK_ROOT"
echo "Add to your shell:"
echo "  export ANDROID_HOME=$SDK_ROOT"
echo "  export ANDROID_SDK_ROOT=$SDK_ROOT"
echo "  export PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\""
