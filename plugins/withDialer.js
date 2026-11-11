// Expo config plugin: wires the Kotlin telecom layer into the generated Android project.
const { withAndroidManifest, withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const attr = (name) => ({ $: { 'android:name': name } });

function copyDir(src, dest) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    if (entry.isDirectory()) copyDir(from, dest);
    else if (entry.name.endsWith('.kt')) fs.copyFileSync(from, path.join(dest, entry.name));
  }
}

module.exports = function withDialer(config) {
  // 1. Manifest: dialer-eligible intent filters, lock-screen flags, InCallService
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    const main = app.activity.find((a) => a.$['android:name'] === '.MainActivity');
    main.$['android:showWhenLocked'] = 'true';
    main.$['android:turnScreenOn'] = 'true';
    main['intent-filter'] = main['intent-filter'] || [];
    const has = (cond) => main['intent-filter'].some(cond);
    if (!has((f) => (f.action || []).some((a) => a.$['android:name'] === 'android.intent.action.DIAL'))) {
      const tel = { $: { 'android:scheme': 'tel' } };
      main['intent-filter'].push(
        { action: [attr('android.intent.action.DIAL')], category: [attr('android.intent.category.DEFAULT')] },
        { action: [attr('android.intent.action.DIAL')], category: [attr('android.intent.category.DEFAULT')], data: [tel] },
        {
          action: [attr('android.intent.action.VIEW')],
          category: [attr('android.intent.category.DEFAULT'), attr('android.intent.category.BROWSABLE')],
          data: [tel],
        }
      );
    }
    app.service = app.service || [];
    if (!app.service.some((s) => s.$['android:name'] === '.DialerInCallService')) {
      app.service.push({
        $: {
          'android:name': '.DialerInCallService',
          'android:permission': 'android.permission.BIND_INCALL_SERVICE',
          'android:exported': 'true',
        },
        'meta-data': [{ $: { 'android:name': 'android.telecom.IN_CALL_SERVICE_UI', 'android:value': 'true' } }],
        'intent-filter': [{ action: [attr('android.telecom.InCallService')] }],
      });
    }
    return cfg;
  });

  // 2. Copy Kotlin sources into the app package
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android.package;
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
      fs.mkdirSync(dest, { recursive: true });
      copyDir(path.join(cfg.modRequest.projectRoot, 'native'), dest);
      return cfg;
    },
  ]);

  // 3. Register the native package safely in Kotlin
  config = withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('DialerPackage()')) {
      if (src.includes('PackageList(this).packages.apply {')) {
        src = src.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n              add(DialerPackage())'
        );
      } else if (src.includes('val packages = PackageList(this).packages')) {
        src = src.replace(
          'val packages = PackageList(this).packages',
          'val packages = PackageList(this).packages.toMutableList()\n            packages.add(DialerPackage())'
        );
      } else {
        src = src.replace('return packages', 'packages.add(DialerPackage())\n          return packages');
      }
    }
    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
};
