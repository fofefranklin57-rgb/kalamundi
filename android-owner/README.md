# Kalamundi — Android WebView

Application Android minimale (WebView) ouvrant directement la plateforme publique Kalamundi.

## URL de production

L'app charge `https://kalamundi.afrisaas.com/`.
Les domaines Kalamundi, Supabase et Fapshi sont autorisés dans la WebView.

## Builder l'APK (Android Studio)

1. Ouvre ce dossier `android-owner/` dans **Android Studio**
2. Menu → **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. L'APK debug se trouve dans : `app/build/outputs/apk/debug/app-debug.apk`

## Builder l'APK (ligne de commande)

```bash
# Windows
gradlew.bat assembleDebug

# Mac/Linux
./gradlew assembleDebug
```

## Générer un AAB signé pour Google Play

1. Menu → **Build → Generate Signed Bundle / APK**
2. Choisir **Android App Bundle (AAB)** pour Google Play
3. Créer ou utiliser un keystore existant
4. Remplir les champs dans `app/build.gradle` section `signingConfigs`
5. Builder en mode `release`

## Caractéristiques de l'app

- **Poids** : ~4 Mo (aucune dépendance)
- **minSdk** : 24 (Android 7.0+)
- **Permissions** : INTERNET uniquement
- **Session** : cookies persistants (Supabase reste connecté)
- **Bouton retour** : navigue dans la WebView
- **Hors-ligne** : écran dédié avec bouton "Réessayer"
- **Plein écran** : statusbar assortie au thème vert foncé
