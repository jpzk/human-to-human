#!/bin/sh
# Builds a signed debug APK without Gradle: javac + d8 + aapt2 + apksigner.
# usage: APP_URL=https://your-deployment.example ./build.sh
set -eu
cd "$(dirname "$0")"
: "${APP_URL:?set APP_URL to the deployed site, e.g. APP_URL=https://hands.example ./build.sh}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
JAR="$SDK/platforms/android-35/android.jar"
JDK="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export PATH="$JDK/bin:$PATH"  # d8 and apksigner call java from PATH
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/res"

cat > res/values/strings.xml <<XML
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">hands</string>
    <string name="app_url">$APP_URL</string>
</resources>
XML

"$BT/aapt2" compile --dir res -o "$OUT/res/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$JAR" --manifest AndroidManifest.xml \
  --java "$OUT/gen" "$OUT/res/res.zip" --auto-add-overlay
"$JDK/bin/javac" -source 11 -target 11 -nowarn -classpath "$JAR" -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java')
"$BT/d8" --release --lib "$JAR" --min-api 24 --output "$OUT" $(find "$OUT/classes" -name '*.class')
(cd "$OUT" && zip -q unsigned.apk classes.dex)
"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$HOME/.android/debug.keystore" --ks-pass pass:android \
  --key-pass pass:android --ks-key-alias androiddebugkey --out hands.apk "$OUT/aligned.apk"
echo "built android/hands.apk for $APP_URL"
