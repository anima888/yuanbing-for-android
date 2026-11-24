#!/usr/bin/env bash
set -e

# Build from the directory that contains this script. On Windows/Git Bash with a
# non-ASCII workspace path, you can override EB_ROOT with an ASCII junction
# (e.g. EB_ROOT=/d/ebapp) so aapt2 can read paths reliably.
ROOT="${EB_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
cd "$ROOT"

# Toolchain. Override with environment variables on other machines.
JDK="${EB_JDK:-D:/ebtools/jdk17/jdk-17.0.21.1+2}"
BT="${EB_BT:-D:/ebtools/bt/android-13}"
PLAT="${EB_PLATFORM:-D:/ebtools/platform/android-13}"
PY="${EB_PYTHON:-python}"

if [ ! -x "$JDK/bin/javac" ]; then
  echo "javac not found at $JDK/bin/javac" >&2
  echo "Set EB_JDK, EB_BT and EB_PLATFORM (see README)." >&2
  exit 1
fi
if [ ! -x "$BT/aapt2.exe" ] && [ ! -x "$BT/aapt2" ]; then
  echo "aapt2 not found in $BT" >&2
  exit 1
fi
if [ ! -f "$PLAT/android.jar" ]; then
  echo "android.jar not found in $PLAT" >&2
  exit 1
fi

rm -rf build
mkdir -p build/gen build/classes build/dex

echo "== aapt2 link =="
"$BT/aapt2.exe" link -o build/base.apk -I "$PLAT/android.jar" \
  --manifest android/AndroidManifest.xml -A www --java build/gen --auto-add-overlay

echo "== javac =="
"$JDK/bin/javac" -encoding UTF-8 -source 8 -target 8 -classpath "$PLAT/android.jar" \
  -d build/classes $(find android/src -name '*.java')

echo "== d8 =="
"$JDK/bin/java" -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 \
  --lib "$PLAT/android.jar" --min-api 23 --release --output build/dex \
  $(find build/classes -name '*.class')

echo "== pack =="
"$PY" android/pack.py build/base.apk build/dex/classes.dex build/packed.apk

echo "== zipalign =="
"$BT/zipalign.exe" -f 4 build/packed.apk build/aligned.apk

echo "== sign =="
KS="${EB_KEYSTORE:-signing/emotionball.jks}"
STORE_PASS="${EB_STOREPASS:-}"
KEY_PASS="${EB_KEYPASS:-$STORE_PASS}"
if [ -z "$STORE_PASS" ]; then
  echo "缺少签名密码：请先设置 EB_STOREPASS（可选 EB_KEYPASS，默认与 store 相同）" >&2
  exit 2
fi
mkdir -p signing
if [ ! -f "$KS" ]; then
  "$JDK/bin/keytool" -genkeypair -keystore "$KS" \
    -storepass "$STORE_PASS" -keypass "$KEY_PASS" -alias emotionball \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=yuanbing for Android, O=Yuanbing, C=CN" -noprompt
fi
"$JDK/bin/java" -jar "$BT/lib/apksigner.jar" sign \
  --ks "$KS" --ks-pass "pass:$STORE_PASS" --key-pass "pass:$KEY_PASS" \
  --out build/yuanbing-for-Android.apk build/aligned.apk

"$JDK/bin/java" -jar "$BT/lib/apksigner.jar" verify --print-certs build/yuanbing-for-Android.apk | head -5
ls -lh build/yuanbing-for-Android.apk
