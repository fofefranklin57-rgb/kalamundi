# Kalamundi Owner — APK WebView

Application Android minimale (WebView) ouvrant directement le Owner Dashboard.

## Avant de builder

1. Ouvre `app/src/main/java/com/kalamundi/owner/MainActivity.java`
2. Ligne 16 — remplace l'URL par ton vrai domaine :
   ```java
   private static final String OWNER_URL = "https://TON-DOMAINE.com/pages/owner.html";
   ```

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

## Générer un APK signé (release)

1. Menu → **Build → Generate Signed Bundle / APK**
2. Créer ou utiliser un keystore existant
3. Remplir les champs dans `app/build.gradle` section `signingConfigs`
4. Builder en mode `release`

## Caractéristiques de l'app

- **Poids** : ~4 Mo (aucune dépendance)
- **minSdk** : 24 (Android 7.0+)
- **Permissions** : INTERNET uniquement
- **Session** : cookies persistants (Supabase reste connecté)
- **Bouton retour** : navigue dans la WebView
- **Hors-ligne** : écran dédié avec bouton "Réessayer"
- **Plein écran** : statusbar assortie au thème vert foncé
