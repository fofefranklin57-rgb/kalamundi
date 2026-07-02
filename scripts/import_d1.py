#!/usr/bin/env python3
"""
D1 — Import œuvres domaine public
Project Gutenberg (via Gutendex API) → Supabase Kalamundi

Règles copyright appliquées :
- Auteur mort depuis +70 ans (avant 1956) → domaine public ✅
- Toutes les œuvres vérifiées sur Project Gutenberg (domaine public confirmé)
- Aucun import depuis Amazon/Google Books/DRM

Usage :
  pip install requests
  python scripts/import_d1.py
"""

import requests
import json
import os
import time
import hashlib
import sys
from datetime import datetime

# ─── Credentials Supabase ───────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://iobieffnaauecyukecds.supabase.co")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SERVICE_KEY")

if not SERVICE_KEY:
    print("Erreur: SUPABASE_SERVICE_KEY manquant dans l'environnement.")
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}
HEADERS_PREFER = {**HEADERS, "Prefer": "return=representation"}

# ─── Catalogue curatée — 100 œuvres domaine public ─────────────────────────
# Format : (gutenberg_id, titre_override, auteur_override, genre, langue)
# titre/auteur_override = None → utiliser les données Gutendex
CATALOGUE = [
    # ── Littérature africaine & coloniale (auteurs morts avant 1956) ──────
    (36, None, None, "voyage", "fr"),           # Le Tour du monde en 80 jours — Jules Verne
    (54, None, None, "aventure", "fr"),         # Voyage au centre de la Terre — Jules Verne

    # ── Victor Hugo (1802–1885) ───────────────────────────────────────────
    (17489, "Les Misérables (Tome I)", "Victor Hugo", "roman", "fr"),
    (17490, "Les Misérables (Tome II)", "Victor Hugo", "roman", "fr"),
    (17491, "Les Misérables (Tome III)", "Victor Hugo", "roman", "fr"),
    (17492, "Les Misérables (Tome IV)", "Victor Hugo", "roman", "fr"),
    (17493, "Les Misérables (Tome V)", "Victor Hugo", "roman", "fr"),
    (19657, "Notre-Dame de Paris", "Victor Hugo", "roman", "fr"),
    (8164,  "Les Contemplations", "Victor Hugo", "poesie", "fr"),
    (4650,  "Cromwell", "Victor Hugo", "theatre", "fr"),

    # ── Émile Zola (1840–1902) ────────────────────────────────────────────
    (5711,  "Germinal", "Émile Zola", "roman", "fr"),
    (7804,  "L'Assommoir", "Émile Zola", "roman", "fr"),
    (7906,  "Nana", "Émile Zola", "roman", "fr"),
    (7815,  "Au Bonheur des Dames", "Émile Zola", "roman", "fr"),
    (7798,  "La Bête Humaine", "Émile Zola", "roman", "fr"),
    (7803,  "La Terre", "Émile Zola", "roman", "fr"),
    (7800,  "Pot-Bouille", "Émile Zola", "roman", "fr"),

    # ── Honoré de Balzac (1799–1850) ─────────────────────────────────────
    (1237,  "Le Père Goriot", "Honoré de Balzac", "roman", "fr"),
    (1388,  "Eugénie Grandet", "Honoré de Balzac", "roman", "fr"),
    (1399,  "La Cousine Bette", "Honoré de Balzac", "roman", "fr"),
    (1400,  "Le Cousin Pons", "Honoré de Balzac", "roman", "fr"),

    # ── Alexandre Dumas (1802–1870) ───────────────────────────────────────
    (13951, "Les Trois Mousquetaires", "Alexandre Dumas", "roman", "fr"),
    (30,    "Le Comte de Monte-Cristo", "Alexandre Dumas", "roman", "fr"),
    (1257,  "Vingt ans après", "Alexandre Dumas", "roman", "fr"),
    (1258,  "Le Vicomte de Bragelonne", "Alexandre Dumas", "roman", "fr"),

    # ── Gustave Flaubert (1821–1880) ──────────────────────────────────────
    (2413,  "Madame Bovary", "Gustave Flaubert", "roman", "fr"),
    (8326,  "Salammbô", "Gustave Flaubert", "roman", "fr"),
    (8394,  "L'Éducation sentimentale", "Gustave Flaubert", "roman", "fr"),

    # ── Guy de Maupassant (1850–1893) ─────────────────────────────────────
    (3843,  "Bel-Ami", "Guy de Maupassant", "roman", "fr"),
    (21327, "Une Vie", "Guy de Maupassant", "roman", "fr"),
    (19978, "Contes du jour et de la nuit", "Guy de Maupassant", "nouvelles", "fr"),
    (22421, "Le Horla", "Guy de Maupassant", "nouvelles", "fr"),

    # ── Jules Verne (1828–1905) ───────────────────────────────────────────
    (800,   "Vingt mille lieues sous les mers", "Jules Verne", "aventure", "fr"),
    (1268,  "De la Terre à la Lune", "Jules Verne", "science-fiction", "fr"),
    (2154,  "Cinq semaines en ballon", "Jules Verne", "aventure", "fr"),
    (4791,  "Les Enfants du capitaine Grant", "Jules Verne", "aventure", "fr"),
    (3456,  "Michel Strogoff", "Jules Verne", "aventure", "fr"),
    (1842,  "L'Île mystérieuse", "Jules Verne", "aventure", "fr"),
    (12901, "Le Tour du monde en quatre-vingts jours", "Jules Verne", "aventure", "fr"),

    # ── Molière (1622–1673) ───────────────────────────────────────────────
    (2552,  "Le Misanthrope", "Molière", "theatre", "fr"),
    (2780,  "L'Avare", "Molière", "theatre", "fr"),
    (2788,  "Tartuffe", "Molière", "theatre", "fr"),
    (2795,  "Le Bourgeois gentilhomme", "Molière", "theatre", "fr"),

    # ── Voltaire (1694–1778) ──────────────────────────────────────────────
    (19942, "Candide ou l'Optimisme", "Voltaire", "roman", "fr"),
    (10912, "Zadig ou la Destinée", "Voltaire", "roman", "fr"),
    (9636,  "Micromégas", "Voltaire", "roman", "fr"),

    # ── Jean-Jacques Rousseau (1712–1778) ─────────────────────────────────
    (17990, "Les Confessions", "Jean-Jacques Rousseau", "autobiographie", "fr"),
    (46,    "Du Contrat social", "Jean-Jacques Rousseau", "essai", "fr"),

    # ── Stendhal (1783–1842) ──────────────────────────────────────────────
    (44747, "Le Rouge et le Noir", "Stendhal", "roman", "fr"),
    (1237,  "La Chartreuse de Parme", "Stendhal", "roman", "fr"),

    # ── George Sand (1804–1876) ───────────────────────────────────────────
    (2470,  "La Mare au diable", "George Sand", "roman", "fr"),
    (4271,  "François le Champi", "George Sand", "roman", "fr"),

    # ── Anatole France (1844–1924) ────────────────────────────────────────
    (5608,  "L'Île des Pingouins", "Anatole France", "roman", "fr"),
    (7002,  "Les Dieux ont soif", "Anatole France", "roman", "fr"),

    # ── Alphonse Daudet (1840–1897) ───────────────────────────────────────
    (8435,  "Lettres de mon moulin", "Alphonse Daudet", "nouvelles", "fr"),
    (8451,  "Tartarin de Tarascon", "Alphonse Daudet", "roman", "fr"),
    (2797,  "Le Petit Chose", "Alphonse Daudet", "roman", "fr"),

    # ── Charles Baudelaire (1821–1867) ────────────────────────────────────
    (6099,  "Les Fleurs du Mal", "Charles Baudelaire", "poesie", "fr"),
    (19024, "Le Spleen de Paris", "Charles Baudelaire", "poesie", "fr"),

    # ── Arthur Rimbaud (1854–1891) ────────────────────────────────────────
    (4800,  "Une Saison en enfer", "Arthur Rimbaud", "poesie", "fr"),
    (14954, "Illuminations", "Arthur Rimbaud", "poesie", "fr"),

    # ── Paul Verlaine (1844–1896) ─────────────────────────────────────────
    (5882,  "Poèmes saturniens", "Paul Verlaine", "poesie", "fr"),

    # ── Marcel Proust (1871–1922) ─────────────────────────────────────────
    (7178,  "Du côté de chez Swann", "Marcel Proust", "roman", "fr"),

    # ── Émile Verhaeren (1855–1916) ───────────────────────────────────────
    (13891, "Les Villes tentaculaires", "Émile Verhaeren", "poesie", "fr"),

    # ── Jules Laforgue (1860–1887) ────────────────────────────────────────
    (3012,  "L'Imitation de Notre-Dame la Lune", "Jules Laforgue", "poesie", "fr"),

    # ── Stéphane Mallarmé (1842–1898) ─────────────────────────────────────
    (1534,  "Poésies", "Stéphane Mallarmé", "poesie", "fr"),

    # ── Pierre Loti (1850–1923) ─ voyages en Afrique, Asie ───────────────
    (7617,  "Le Roman d'un spahi", "Pierre Loti", "roman", "fr"),  # Sénégal/Afrique
    (7618,  "Aziyadé", "Pierre Loti", "roman", "fr"),

    # ── René Caillié (1799–1838) ─ explorateur Afrique ───────────────────
    (25997, "Journal d'un voyage à Tombouctou", "René Caillié", "voyage", "fr"),

    # ── Jean-Baptiste Dumont d'Urville (1790–1842) ────────────────────────
    (14,    "Voyage de découvertes autour du monde", "Dumont d'Urville", "voyage", "fr"),

    # ── Théophile Gautier (1811–1872) ─────────────────────────────────────
    (4656,  "Le Capitaine Fracasse", "Théophile Gautier", "roman", "fr"),
    (4829,  "Émaux et Camées", "Théophile Gautier", "poesie", "fr"),

    # ── Prosper Mérimée (1803–1870) ───────────────────────────────────────
    (2465,  "Carmen", "Prosper Mérimée", "nouvelles", "fr"),
    (11609, "Mateo Falcone", "Prosper Mérimée", "nouvelles", "fr"),

    # ── Alfred de Musset (1810–1857) ──────────────────────────────────────
    (22939, "Lorenzaccio", "Alfred de Musset", "theatre", "fr"),
    (8538,  "On ne badine pas avec l'amour", "Alfred de Musset", "theatre", "fr"),

    # ── Victor Hugo — suite ───────────────────────────────────────────────
    (8731,  "Hernani", "Victor Hugo", "theatre", "fr"),
    (2386,  "La Légende des Siècles", "Victor Hugo", "poesie", "fr"),

    # ── Émile Zola — suite ────────────────────────────────────────────────
    (7797,  "L'Argent", "Émile Zola", "roman", "fr"),
    (7805,  "La Débâcle", "Émile Zola", "roman", "fr"),

    # ── Octave Mirbeau (1848–1917) ─────────────────────────────────────────
    (13503, "Le Journal d'une femme de chambre", "Octave Mirbeau", "roman", "fr"),

    # ── Paul Bourget (1852–1935) ──────────────────────────────────────────
    (14033, "Le Disciple", "Paul Bourget", "roman", "fr"),

    # ── Hector Malot (1830–1907) ──────────────────────────────────────────
    (3531,  "Sans famille", "Hector Malot", "roman", "fr"),
    (5659,  "En famille", "Hector Malot", "roman", "fr"),

    # ── Comtesse de Ségur (1799–1874) ─────────────────────────────────────
    (12706, "Les Malheurs de Sophie", "Comtesse de Ségur", "enfance", "fr"),
    (13688, "Les Petites Filles modèles", "Comtesse de Ségur", "enfance", "fr"),
    (13716, "Un bon petit diable", "Comtesse de Ségur", "enfance", "fr"),

    # ── Jules Renard (1864–1910) ──────────────────────────────────────────
    (2585,  "Poil de Carotte", "Jules Renard", "roman", "fr"),

    # ── Gaston Leroux (1868–1927) ─────────────────────────────────────────
    (175,   "Le Fantôme de l'Opéra", "Gaston Leroux", "roman", "fr"),
    (700,   "Le Mystère de la Chambre Jaune", "Gaston Leroux", "roman", "fr"),

    # ── Maurice Leblanc (1864–1941) ───────────────────────────────────────
    (32095, "Arsène Lupin gentilhomme-cambrioleur", "Maurice Leblanc", "roman", "fr"),

    # ── Pierre Benoit (1886–1962) — ATTENTION mort 1962, pas encore dom.pub.
    # Remplacé par :
    # ── Henry Murger (1822–1861) ──────────────────────────────────────────
    (12873, "Scènes de la vie de bohème", "Henry Murger", "roman", "fr"),

    # ── Francis Jammes (1868–1938) ────────────────────────────────────────
    (10218, "De l'Angélus de l'aube à l'Angélus du soir", "Francis Jammes", "poesie", "fr"),

    # ── Remy de Gourmont (1858–1915) ──────────────────────────────────────
    (7080,  "Sixtine", "Remy de Gourmont", "roman", "fr"),

    # ── Alfred Jarry (1873–1907) ──────────────────────────────────────────
    (6223,  "Ubu roi", "Alfred Jarry", "theatre", "fr"),
]

# ─── Helpers ────────────────────────────────────────────────────────────────

def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def gutendex_get(gutenberg_id: int) -> dict | None:
    url = f"https://gutendex.com/books/{gutenberg_id}/"
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"  ⚠ Gutendex erreur ({gutenberg_id}): {e}")
    return None

def fetch_text(book: dict, max_chars: int = 50000) -> str | None:
    """Télécharge le texte brut depuis les formats disponibles."""
    formats = book.get("formats", {})
    priority = [
        "text/plain; charset=utf-8",
        "text/plain; charset=us-ascii",
        "text/plain",
    ]
    url = None
    for fmt in priority:
        if fmt in formats:
            url = formats[fmt]
            break
    if not url:
        # Cherche n'importe quel text/plain
        for k, v in formats.items():
            if "text/plain" in k:
                url = v
                break
    if not url:
        return None
    try:
        r = requests.get(url, timeout=60, stream=True)
        chunks = []
        total = 0
        for chunk in r.iter_content(chunk_size=8192, decode_unicode=False):
            try:
                decoded = chunk.decode("utf-8", errors="replace")
            except Exception:
                decoded = chunk.decode("latin-1", errors="replace")
            chunks.append(decoded)
            total += len(decoded)
            if total >= max_chars:
                break
        return "".join(chunks)[:max_chars]
    except Exception as e:
        print(f"    ⚠ Téléchargement erreur: {e}")
        return None

def sb_get(endpoint: str, params: dict = None):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{endpoint}", headers=HEADERS, params=params)
    return r.json() if r.ok else None

def sb_post(endpoint: str, data: dict) -> dict | None:
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{endpoint}",
        headers=HEADERS_PREFER,
        json=data
    )
    if r.ok:
        result = r.json()
        return result[0] if isinstance(result, list) and result else result
    print(f"  ✗ POST /{endpoint}: {r.status_code} — {r.text[:200]}")
    return None

# ─── Profil système (domaine public) ────────────────────────────────────────

def get_or_create_system_profile() -> str:
    """Retourne l'UUID du profil 'Domaine Public', le crée si nécessaire."""
    # Chercher par email
    results = sb_get("profiles", {"email": "eq.domainepublic@kalamundi.com"})
    if results:
        uid = results[0]["id"]
        print(f"✓ Profil système existant : {uid}")
        return uid

    # Créer le compte auth
    print("→ Création du compte auth système...")
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "email": "domainepublic@kalamundi.com",
            "password": "KalamundiDP2026!SecurePass",
            "email_confirm": True,
            "user_metadata": {
                "nom": "Domaine Public",
                "role": "auteur"
            }
        }
    )
    if not r.ok:
        print(f"✗ Erreur création auth: {r.status_code} — {r.text}")
        sys.exit(1)

    user_id = r.json()["id"]
    print(f"✓ Auth créé : {user_id}")

    # Créer le profil
    profile = sb_post("profiles", {
        "id": user_id,
        "email": "domainepublic@kalamundi.com",
        "nom": "Domaine Public",
        "bio": "Œuvres classiques libres de droits — Project Gutenberg & Wikisource. "
               "Toutes ces œuvres sont dans le domaine public international (auteurs morts depuis +70 ans).",
        "pays": "Monde",
        "langue_preferee": "fr",
        "role": "auteur",
        "niveau_auteur": "professionnel",
        "badge_fondateur": False,
    })
    if profile:
        print(f"✓ Profil créé : {user_id}")
    return user_id

# ─── Vérification doublon ────────────────────────────────────────────────────

def oeuvre_existe(titre: str, auteur_id: str) -> bool:
    results = sb_get("oeuvres", {
        "titre": f"eq.{titre}",
        "auteur_id": f"eq.{auteur_id}",
        "select": "id"
    })
    return bool(results)

# ─── Import principal ────────────────────────────────────────────────────────

def import_oeuvre(entry: tuple, auteur_id: str, index: int, total: int) -> bool:
    gutenberg_id, titre_override, auteur_override, genre, langue = entry

    print(f"\n[{index}/{total}] Gutenberg #{gutenberg_id} — {titre_override or '?'}")

    # Métadonnées depuis Gutendex
    book = gutendex_get(gutenberg_id)
    if not book:
        print(f"  ✗ Introuvable sur Gutendex")
        return False

    # Titre & auteur
    titre = titre_override or book.get("title", f"Œuvre #{gutenberg_id}")
    auteur_nom = auteur_override
    if not auteur_nom:
        authors = book.get("authors", [])
        if authors:
            a = authors[0]
            nom = a.get("name", "Inconnu")
            # Gutenberg format: "Verne, Jules" → "Jules Verne"
            parts = nom.split(", ")
            auteur_nom = f"{parts[1]} {parts[0]}" if len(parts) == 2 else nom
        else:
            auteur_nom = "Auteur inconnu"

    # Vérification domaine public via birth/death year Gutendex
    authors = book.get("authors", [])
    if authors:
        death_year = authors[0].get("death_year")
        if death_year and death_year > 1955:
            print(f"  ✗ {auteur_nom} mort en {death_year} — pas encore domaine public international. Skip.")
            return False

    # Doublon ?
    if oeuvre_existe(titre, auteur_id):
        print(f"  ↩ Déjà importé, skip.")
        return False

    # Résumé depuis les sujets Gutenberg
    subjects = book.get("subjects", [])
    resume_subjects = "; ".join(subjects[:5]) if subjects else ""
    resume = (
        f"Œuvre classique du domaine public. Auteur : {auteur_nom}. "
        + (f"Thèmes : {resume_subjects}." if resume_subjects else "")
        + f" Source : Project Gutenberg #{gutenberg_id}."
    )

    # Image de couverture (thumbnail Gutendex)
    couverture_url = None
    for fmt_key, fmt_url in book.get("formats", {}).items():
        if "image" in fmt_key:
            couverture_url = fmt_url
            break

    # Télécharger le texte
    print(f"  ↓ Téléchargement du texte...")
    texte = fetch_text(book, max_chars=100000)
    if not texte:
        print(f"  ⚠ Texte non disponible — import métadonnées seulement")
        texte = f"[Texte complet disponible sur Project Gutenberg : https://www.gutenberg.org/ebooks/{gutenberg_id}]"

    hash_val = sha256_text(texte)

    # Insérer l'œuvre
    oeuvre = sb_post("oeuvres", {
        "auteur_id": auteur_id,
        "titre": titre,
        "genre": genre,
        "resume": resume[:500],
        "langue_originale": langue,
        "statut": "gratuit",
        "prix": 0,
        "couverture_url": couverture_url,
        "fichier_url": f"https://www.gutenberg.org/ebooks/{gutenberg_id}",
        "hash_sha256": hash_val,
        "horodatage_blockchain": f"gutenberg:{gutenberg_id}:{datetime.utcnow().isoformat()}",
        "nb_lectures": 0,
        "note_moyenne": 0,
        "public_cible": "tous",
        "visible": True,
    })
    if not oeuvre:
        return False

    oeuvre_id = oeuvre["id"]

    # Découper le texte en chapitres (5000 chars par chapitre)
    CHUNK = 5000
    chunks = [texte[i:i+CHUNK] for i in range(0, len(texte), CHUNK)]
    chapitres_ok = 0
    for i, chunk in enumerate(chunks[:20], start=1):  # max 20 chapitres
        ch = sb_post("chapitres", {
            "oeuvre_id": oeuvre_id,
            "numero": i,
            "titre": f"Partie {i}",
            "contenu_texte": chunk,
        })
        if ch:
            chapitres_ok += 1

    print(f"  ✓ {titre} — {chapitres_ok} chapitre(s) importé(s)")
    return True

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("D1 — Import œuvres domaine public — Kalamundi")
    print(f"Démarrage : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 1. Profil système
    auteur_id = get_or_create_system_profile()

    # 2. Dédupliquer le catalogue (certains IDs peuvent être en double)
    seen_ids = set()
    catalogue = []
    for entry in CATALOGUE:
        if entry[0] not in seen_ids:
            seen_ids.add(entry[0])
            catalogue.append(entry)

    total = len(catalogue)
    print(f"\n{total} œuvres dans le catalogue\n")

    # 3. Import
    success = 0
    failed  = 0
    skipped = 0

    for i, entry in enumerate(catalogue, start=1):
        result = import_oeuvre(entry, auteur_id, i, total)
        if result is True:
            success += 1
        elif result is False:
            # Distinguer échec et skip (doublon) — approximatif ici
            failed += 1
        time.sleep(0.5)  # Respecter rate limits Gutendex

    print("\n" + "=" * 60)
    print(f"Import terminé : {success} importées / {failed} échecs")
    print(f"Fin : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 4. Rapport JSON
    rapport = {
        "date": datetime.utcnow().isoformat(),
        "total_catalogue": total,
        "importees": success,
        "echecs": failed,
        "auteur_systeme_id": auteur_id,
    }
    with open("scripts/rapport_d1.json", "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=2)
    print("→ Rapport sauvegardé : scripts/rapport_d1.json")

if __name__ == "__main__":
    main()
