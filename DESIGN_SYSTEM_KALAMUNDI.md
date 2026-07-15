# 🎨 DESIGN SYSTEM KALAMUNDI
### Nouveaux tokens — prêts à appliquer dans `assets/css/base.css`

*Créé le 16 juillet 2026. Objectif : reskin moderne SANS casser la structure. On garde les **noms** de variables existants et les composants BEM — on change surtout les **valeurs** + on ajoute les webfonts. Réf. `BIBLE §10`.*

---

## 1. Principe

Le CSS actuel est bien fait (tokens + BEM + 3 thèmes). On ne réécrit pas : on **change les valeurs des variables** de `base.css`. Comme tout les référence, l'app entière se transforme d'un coup. **Aucune couleur hardcodée** ailleurs.

---

## 2. Typographie (le plus gros effet)

**Auto-héberger** Fraunces + Inter (sous-ensemble latin, `font-display: swap`) dans `assets/fonts/` — ne pas dépendre d'un CDN externe (offline + data).

```css
/* base.css — à ajouter en tête */
@font-face { font-family:'Fraunces'; src:url('/assets/fonts/fraunces-var.woff2') format('woff2');
  font-weight:400 700; font-display:swap; }
@font-face { font-family:'Inter'; src:url('/assets/fonts/inter-var.woff2') format('woff2');
  font-weight:400 700; font-display:swap; }
```

```css
--font-display:   'Fraunces', Georgia, serif;      /* titres, marque, couvertures */
--font-interface: 'Inter', system-ui, sans-serif;  /* UI, texte courant (remplace Calibri) */
--font-lecture:   'Lora', Georgia, serif;           /* corps de lecture (optionnel, sinon Georgia) */
--font-mono:      'Courier New', monospace;
```
> Les titres (`h1–h3`, `.card__title`, hero, logo) passent en `--font-display`. Tout le reste en `--font-interface`.

---

## 3. Couleurs — nouvelles valeurs (thème clair)

Remplacer dans `:root` :

| Variable existante | Ancienne valeur | **Nouvelle valeur** | Intention |
|---|---|---|---|
| `--bg-main` | `#FFFFFF` | **`#FBF8F2`** | base crème chaude (fini le blanc clinique) |
| `--bg-secondary` | `#E9F5EE` (vert) | **`#F2ECDE`** | sable chaud (fini le vert) |
| `--bg-card` | `#F8FAF8` | **`#FFFFFF`** | les cartes « ressortent » en blanc sur la crème |
| `--bg-input` *(nouv.)* | — | **`#FFFFFF`** | champs nets |
| `--text-primary` | `#1A1A1A` | **`#22201C`** | noir chaud, moins dur |
| `--text-secondary` | `#555555` | **`#5C574E`** | brun-gris chaud |
| `--text-light` | `#888888` | **`#8A8272`** | teinte chaude |
| `--border-color` | `#A8D5B5` (vert) | **`#E7E0D2`** | hairline neutre quasi invisible (⚠️ le n°1 du « vieux jeu ») |
| `--border-strong` *(nouv.)* | — | **`#D8CFBB`** | survol / emphase |

**Accents (identité — on garde vert + or, mais en accents) :**
```css
--color-primary:       #1B4332;  /* vert forêt */
--color-primary-light: #2D6A4F;
--color-primary-dark:  #0D2B1F;
--color-accent:        #D4A017;  /* or */
--color-accent-light:  #E9C46A;
--color-accent-dark:   #A97C0E;
```

**États (inchangés ou presque) :** `--color-success:#2D9E5F` · `--color-warning:#E08C00` · `--color-error:#C0392B` · `--color-info:#2980B9`.

---

## 4. Rayons, ombres, espacements

```css
/* Rayons — plus généreux et cohérents */
--border-radius-sm: 8px;    /* était 4 */
--border-radius-md: 12px;   /* était 8 — contrôles, boutons, inputs */
--border-radius-lg: 16px;   /* cartes */
--border-radius-full: 9999px;

/* Ombres — douces, teintées chaud (remplacent les ombres neutres) */
--shadow-sm: 0 1px 2px rgba(43,32,20,.06);
--shadow-md: 0 6px 20px rgba(13,43,31,.10);
--shadow-lg: 0 16px 40px rgba(13,43,31,.14);
```
Espacements : **inchangés** (l'échelle actuelle est bonne).

---

## 5. Ajustements de composants (`components.css`)

- **Boutons** : retirer le `border: 2px solid` → `border: 1px solid transparent` (ou `none`), boutons pleins. Garder `:active { transform: scale(.97) }`.
  - `.btn--primary` : fond `--color-primary`, texte blanc, pas de bordure.
  - `.btn--outline` : `1px solid --border-strong`, texte `--color-primary`.
- **Cartes** : `.card` = fond `--bg-card` (blanc) sur page crème, `border: 1px solid --border-color` (hairline neutre) ou **sans bordure** + `--shadow-sm`. `border-radius: 16px`.
- **Inputs** : `border: 1px solid --border-color` (fini le 1.5px vert), focus `box-shadow: 0 0 0 3px rgba(27,67,50,.10)`.
- **Nav** : ne plus mettre le vert en aplat plein sur toute la barre → fond crème/blanc + accents verts, ou vert foncé réservé au footer/hero.
- **Skeletons** (nouveau) : ajouter un shimmer pour le chargement au lieu du seul spinner.
```css
.skeleton { background:linear-gradient(90deg,#EFE9DD 25%,#F6F1E7 37%,#EFE9DD 63%);
  background-size:400% 100%; animation:shimmer 1.4s ease infinite; border-radius:8px; }
@keyframes shimmer { from{background-position:100% 0} to{background-position:-100% 0} }
```

---

## 6. Thèmes sombre & sépia

- **Sombre** : les valeurs actuelles (vert nuit `#0D1B12` / `#1A2E20`) sont **bonnes et on-brand** → garder, juste vérifier que `--border-color` sombre reste discret (`#2E4D35` ok).
- **Sépia** : garder (`#F4ECD8`) — cohérent avec la nouvelle base crème.
- **Règle** : chaque nouvelle valeur doit rester lisible dans les 3 thèmes (tester contraste).

---

## 7. Ordre d'application pour Codex

1. Ajouter les webfonts (`@font-face`) + `--font-display` / mettre `--font-interface` = Inter.
2. Basculer les titres en `--font-display`.
3. Remplacer les valeurs couleurs du §3 (surtout `--border-color` et `--bg-main`).
4. Rayons + ombres §4.
5. Boutons/cartes/inputs/nav §5, ajouter skeletons.
6. Vérifier les 3 thèmes.
7. Noter dans `EVOLUTION_KALAMUNDI.md`.

> Ne rien hardcoder : toujours passer par ces variables. Un composant qui « sort » du système est un bug.
