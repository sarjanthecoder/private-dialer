# RootAccess Dialer (React Native + Expo + Kotlin)

Real SIM-based dialer. Telecom/InCallService/Call Log are native Kotlin; UI is React Native (Reanimated + Gesture Handler).

## Build the APK

### Option A – EAS cloud (easiest, no Android Studio)
```bash
npm install
npm i -g eas-cli
eas login
eas build -p android --profile preview     # outputs an installable .apk link
```

### Option B – Local
Needs JDK 17 + Android SDK (Android Studio).
```bash
npm install
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

## First run on the phone
1. Allow Phone + Call log (+ Notifications) permissions.
2. Tap the blue banner **"Set as default phone app"** and confirm. Without this role the premium
   incoming/outgoing screens can't take over (calls still work through the system dialer).

## Where things are
- `native/identity/PrivateIdentity.kt` – the ONLY file containing the private number. Display name resolves here.
- `native/telecom/CallManager.kt` – call state, answer/reject/hangup, mute, speaker, DTMF.
- `native/incall/DialerInCallService.kt` – Telecom InCallService + full-screen incoming notification (name only).
- `native/bridge/` – React Native bridge. Exposes `callPrivate()`, `dial()`, `getCallLog()` (private rows masked), etc.
- `plugins/withDialer.js` – Expo config plugin: manifest entries, copies Kotlin, registers the package.
- `src/` – components, screens, navigation, hooks, services, theme, types.

## Privacy – honest limits
- UI-level only. The number is not in JS, UI, nav params, logs or notifications, and the contact is NOT added to Android Contacts.
- It remains visible to the carrier, the system call log, the system dialer and other apps with call-log permission.
- It is hardcoded in the APK, so it can be recovered by decompiling.
- INTERNET permission is blocked in the manifest; nothing leaves the device.
- If you type the number on the keypad, the digits exist briefly in keypad state; the display switches to the name once native recognises it.

## Performance
- `setHighRefreshRate()` requests the panel's highest mode at the current resolution (60/90/120/144Hz...). Actual rate depends on the device.
- Keypad/controls animate on the UI thread (Reanimated worklets + Gesture Handler); lists use fixed-height `getItemLayout`.
- Pulse animation runs only while ringing/dialing, stops once connected.
