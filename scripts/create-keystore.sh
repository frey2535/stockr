#!/usr/bin/env bash
set -euo pipefail

# Creates the Play / sideload upload keystore once. Back up the folder forever.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/android/keystore"
PROPS="$DIR/key.properties"
STORE="$DIR/stockr-upload.jks"
ALIAS="stockr"

mkdir -p "$DIR"

if [[ -f "$STORE" && -f "$PROPS" ]]; then
  echo "Keystore already exists at $STORE"
  exit 0
fi

PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"

keytool -genkeypair -v \
  -keystore "$STORE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$PASSWORD" \
  -keypass "$PASSWORD" \
  -dname "CN=Stockr, OU=CurrentFlow Consulting, O=CurrentFlow Consulting, C=US"

cat > "$PROPS" <<EOF
storeFile=keystore/stockr-upload.jks
storePassword=$PASSWORD
keyAlias=$ALIAS
keyPassword=$PASSWORD
EOF

chmod 600 "$STORE" "$PROPS"
echo "Created $STORE and $PROPS"
echo "Copy android/keystore/ off this machine and keep it safe. Losing it means you cannot update the Play listing."
