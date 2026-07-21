import { readFileSync, existsSync } from 'node:fs';

const paths = {
  gradle: 'android-owner/app/build.gradle',
  manifest: 'android-owner/app/src/main/AndroidManifest.xml',
  activity: 'android-owner/app/src/main/java/com/kalamundi/app/MainActivity.java',
  strings: 'android-owner/app/src/main/res/values/strings.xml',
  layout: 'android-owner/app/src/main/res/layout/activity_main.xml',
  wrapper: 'android-owner/gradlew.bat',
};

for (const [label, path] of Object.entries(paths)) {
  if (!existsSync(path)) fail(`${label} introuvable : ${path}`);
}

const gradle = readFileSync(paths.gradle, 'utf8');
must(gradle, "namespace 'com.kalamundi.app'", 'namespace Android public incorrect');
must(gradle, 'applicationId "com.kalamundi.app"', 'applicationId Play Store incorrect');

const activity = readFileSync(paths.activity, 'utf8');
must(activity, 'package com.kalamundi.app;', 'package Java public incorrect');
must(activity, 'https://kalamundi.afrisaas.com/', 'URL de production absente');
must(activity, 'live.fapshi.com', 'Fapshi non autorisé dans la WebView');
must(activity, 'iobieffnaauecyukecds.supabase.co', 'Supabase Kalamundi non autorisé dans la WebView');
if (/OWNER_URL|owner dashboard|kalamundi\.pages\.dev\/pages\/owner\.html/i.test(activity)) {
  fail('ancien dashboard owner encore référencé');
}

const strings = readFileSync(paths.strings, 'utf8');
must(strings, '<string name="app_name">Kalamundi</string>', 'nom app Android incorrect');

const layout = readFileSync(paths.layout, 'utf8');
must(layout, 'LA PLUME DU MONDE', 'signature marque absente du splash Android');
if (layout.includes('OWNER DASHBOARD')) fail('ancien texte owner encore présent');

const wrapper = readFileSync(paths.wrapper, 'utf8');
must(wrapper, 'gradle-8.4-bin.zip', 'wrapper Gradle local non utilisé');

console.log('Wrapper Android public Kalamundi OK.');

function must(text, needle, message) {
  if (!text.includes(needle)) fail(message);
}

function fail(message) {
  console.error(`Erreur Android wrapper : ${message}`);
  process.exit(1);
}
