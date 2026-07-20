/* ============================================================
   api.js — Tous les appels Supabase centralisés ici
   Kalamundi — La Plume du Monde
   Règle : aucun appel supabase en dehors de ce fichier
   ============================================================ */

import { supabase } from './auth.js';

/* Modèle économique — splits officiels */
export const SPLIT_AUTEUR_PREMIUM = 0.50; // 50% auteur sur ventes premium
export const SPLIT_KALAMUNDI_PREMIUM = 0.50; // 50% Kalamundi
// Pub : 100% Kalamundi, aucun reversement auteur

function colonneManquante(error, colonne) {
  const msg = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return msg.includes(colonne) || error?.code === '42703';
}

function sansChamp(obj, champ) {
  if (!obj || !(champ in obj)) return obj;
  const copie = { ...obj };
  delete copie[champ];
  return copie;
}

const COLONNES_NORMALISATION_CHAPITRES = [
  'chapitre_id',
  'format_source',
  'source_hash',
  'structure_path',
  'epub_href',
  'metadata',
];

function contientColonnesNormalisation(champs = {}) {
  return COLONNES_NORMALISATION_CHAPITRES.some(colonne => colonne in champs);
}

function erreurColonnesNormalisationManquantes(error) {
  return COLONNES_NORMALISATION_CHAPITRES.some(colonne => colonneManquante(error, colonne));
}

const AUTEURS_SYSTEME = new Set([
  '00000000-0000-0000-0000-000000000001',
]);

const NOMS_IMPORTS = [
  'bibliotheque kalamundi',
  'bibliothèque kalamundi',
  'domaine public',
  'creative commons',
];

export function estOeuvreImportee(o) {
  const nom = (o.profiles?.nom || '').toLowerCase();
  const resume = (o.resume || '').toLowerCase();
  return AUTEURS_SYSTEME.has(o.auteur_id)
    || NOMS_IMPORTS.some(source => nom.includes(source))
    || resume.includes('project gutenberg')
    || resume.includes('standard ebooks')
    || resume.includes('openstax')
    || resume.includes('african storybook')
    || resume.includes('domaine public');
}

/* ============================================================
   PROFILS
   ============================================================ */

export const api = {

  /* ---- Profils ------------------------------------------ */

  async getProfil(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, email, nom, prenom, bio, photo_url, pays, ville,
        telephone, date_naissance, genre_identite,
        langue_preferee, role, niveau_auteur, badge_fondateur,
        site_web, reseaux_sociaux,
        langues_parlees, genres_preferes, genres_ecrits,
        compte_verifie, created_at, updated_at
      `)
      .eq('id', userId)
      .single();

    // Profil inexistant (première connexion Google) → le créer
    if (error && error.code === 'PGRST116') {
      const { data: { user } } = await supabase.auth.getUser();
      const nom = user?.user_metadata?.full_name
        || user?.user_metadata?.name
        || user?.email?.split('@')[0]
        || 'Utilisateur';
      const photo = user?.user_metadata?.avatar_url || null;

      const { data: newProfil, error: errCreate } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user.email,
          nom,
          photo_url: photo,
          role: 'auteur',
          langue_preferee: 'fr',
        })
        .select()
        .single();

      if (errCreate) throw errCreate;
      return newProfil;
    }

    if (error) throw error;
    return data;
  },

  async updateProfil(userId, champs) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...champs, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAvatar(userId, fichier) {
    const chemin = `avatars/${userId}/${Date.now()}_${fichier.name}`;
    const { error: uploadError } = await supabase.storage
      .from('couvertures')
      .upload(chemin, fichier, { upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('couvertures').getPublicUrl(chemin);
    await api.updateProfil(userId, { photo_url: urlData.publicUrl });
    return urlData.publicUrl;
  },

  /* ---- Oeuvres ------------------------------------------ */

  async getOeuvres({ page = 1, limit = 20, genre, langue, statut, recherche, tri = 'recent', exclureSysteme = false } = {}) {
    const orderCol = tri === 'lectures' ? 'nb_lectures' : 'created_at';
    let query = supabase
      .from('oeuvres')
      .select(`
        id, titre, genre, resume, langue_originale, statut, prix, chapitres_gratuits,
        couverture_url, nb_lectures, note_moyenne, public_cible,
        created_at, auteur_id,
        profiles!oeuvres_auteur_id_fkey(nom, photo_url, pays, niveau_auteur)
      `, { count: 'exact' })
      .eq('visible', true)
      .order(orderCol, { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (genre)    query = query.eq('genre', genre);
    if (langue)   query = query.eq('langue_originale', langue);
    if (statut)   query = query.eq('statut', statut);
    if (recherche) query = query.ilike('titre', `%${recherche}%`);
    if (exclureSysteme) query = query.neq('auteur_id', '00000000-0000-0000-0000-000000000001');

    let { data, error, count } = await query;
    if (error && colonneManquante(error, 'chapitres_gratuits')) {
      query = supabase
        .from('oeuvres')
        .select(`
          id, titre, genre, resume, langue_originale, statut, prix,
          couverture_url, nb_lectures, note_moyenne, public_cible,
          created_at, auteur_id,
          profiles!oeuvres_auteur_id_fkey(nom, photo_url, pays, niveau_auteur)
        `, { count: 'exact' })
        .eq('visible', true)
        .order(orderCol, { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
      if (genre)    query = query.eq('genre', genre);
      if (langue)   query = query.eq('langue_originale', langue);
      if (statut)   query = query.eq('statut', statut);
      if (recherche) query = query.ilike('titre', `%${recherche}%`);
      if (exclureSysteme) query = query.neq('auteur_id', '00000000-0000-0000-0000-000000000001');
      const retry = await query;
      data = (retry.data || []).map(o => ({ ...o, chapitres_gratuits: 0 }));
      error = retry.error;
      count = retry.count;
    }
    if (error) throw error;
    return { data, total: count };
  },

  async getStatsAccueil({ collection = 'tout' } = {}) {
    let { data, error } = await supabase
      .from('oeuvres')
      .select('id, nb_lectures, auteur_id, resume, profiles!oeuvres_auteur_id_fkey(nom)')
      .eq('visible', true);

    if (error && colonneManquante(error, 'nb_lectures')) {
      const retry = await supabase
        .from('oeuvres')
        .select('id, auteur_id, resume, profiles!oeuvres_auteur_id_fkey(nom)')
        .eq('visible', true);
      data = (retry.data || []).map(o => ({ ...o, nb_lectures: 0 }));
      error = retry.error;
    }
    if (error) throw error;

    const oeuvres = collection === 'originaux'
      ? (data || []).filter(o => !estOeuvreImportee(o))
      : (data || []);

    return {
      totalOeuvres: oeuvres.length,
      totalLectures: oeuvres.reduce((somme, oeuvre) => somme + Number(oeuvre.nb_lectures || 0), 0),
    };
  },

  async getOeuvre(id) {
    const { data, error } = await supabase
      .from('oeuvres')
      .select(`
        *, frequence_publication, date_debut_publication,
        profiles!oeuvres_auteur_id_fkey(id, nom, photo_url, pays, bio, niveau_auteur, badge_fondateur),
        chapitres(id, numero, titre, created_at)
      `)
      .eq('id', id)
      .eq('visible', true)
      .order('numero', { referencedTable: 'chapitres', ascending: true })
      .single();
    if (error) throw error;
    return data;
  },

  async getOffresLivre(oeuvreId, oeuvreFallback = null) {
    if (!oeuvreId) return [];

    const fabriquerOffreDepuisOeuvre = (oeuvre) => {
      if (!oeuvre) return [];
      const premium = oeuvre.statut === 'premium';
      return [{
        id: `legacy-${oeuvre.id}-${premium ? 'achat' : 'lecture'}`,
        source_oeuvre_id: oeuvre.id,
        type: premium ? 'achat_numerique' : 'lecture_gratuite',
        statut: 'active',
        prix: premium ? Number(oeuvre.prix || 0) : 0,
        devise: 'XAF',
        fapshi_enabled: premium,
        chapitres_gratuits: Number(oeuvre.chapitres_gratuits || 0),
        royalties_auteur_pct: premium ? 50 : 0,
        royalties_plateforme_pct: premium ? 50 : 0,
        ordre: premium ? 20 : 10,
        metadata: { fallback: true },
      }];
    };

    let { data, error } = await supabase
      .from('livre_offres')
      .select(`
        id, livre_id, edition_id, source_oeuvre_id, vendeur_id, type, statut,
        prix, prix_barre, devise, fapshi_enabled, chapitres_gratuits, stock, duree_acces_jours,
        royalties_auteur_pct, royalties_plateforme_pct, ordre, metadata,
        livre_editions(id, format, statut, fichier_url, epub_url, nb_chapitres),
        livres(id, oeuvre_id, titre, couverture_url, langue_originale, statut)
      `)
      .eq('source_oeuvre_id', oeuvreId)
      .eq('statut', 'active')
      .order('ordre', { ascending: true });

    if (error) {
      console.warn('Offres livre indisponibles, fallback oeuvre :', error);
      return fabriquerOffreDepuisOeuvre(oeuvreFallback);
    }

    if (!data?.length) {
      return fabriquerOffreDepuisOeuvre(oeuvreFallback);
    }

    return data;
  },

  /* ---- Emprunter / prêt numérique (P4 #15) --------------- */

  /* Statut du prêt pour l'utilisateur courant sur une offre donnée :
     emprunt actif (avec échéance), position en file d'attente, ou rien. */
  async getStatutEmpruntOffre(offreId, userId) {
    if (!offreId || !userId) return { emprunt: null, position: null };

    const { data: emprunt } = await supabase
      .from('emprunts')
      .select('id, expire_le, emprunte_le')
      .eq('offre_id', offreId)
      .eq('emprunteur_id', userId)
      .eq('statut', 'actif')
      .maybeSingle();
    if (emprunt) return { emprunt, position: null };

    const { data: file } = await supabase
      .from('emprunts_file_attente')
      .select('id, created_at')
      .eq('offre_id', offreId)
      .eq('utilisateur_id', userId)
      .eq('statut', 'attente')
      .maybeSingle();
    if (!file) return { emprunt: null, position: null };

    const { count } = await supabase
      .from('emprunts_file_attente')
      .select('id', { count: 'exact', head: true })
      .eq('offre_id', offreId)
      .eq('statut', 'attente')
      .lte('created_at', file.created_at);

    return { emprunt: null, position: count || 1 };
  },

  async emprunterLivre(offreId) {
    const { data, error } = await supabase.rpc('emprunter_livre', { p_offre_id: offreId });
    if (error) throw new Error(error.message || 'Emprunt impossible.');
    return data;
  },

  async rendreLivre(empruntId) {
    const { error } = await supabase.rpc('rendre_livre', { p_emprunt_id: empruntId });
    if (error) throw new Error(error.message || 'Retour impossible.');
  },

  async rejoindreFileAttente(offreId) {
    const { data, error } = await supabase.rpc('rejoindre_file_attente', { p_offre_id: offreId });
    if (error) throw new Error(error.message || 'Impossible de rejoindre la file d\'attente.');
    return data;
  },

  async quitterFileAttente(offreId) {
    const { error } = await supabase.rpc('quitter_file_attente', { p_offre_id: offreId });
    if (error) throw new Error(error.message || 'Impossible de quitter la file d\'attente.');
  },

  async getMesEmprunts(userId) {
    const { data, error } = await supabase
      .from('emprunts')
      .select(`
        id, expire_le, emprunte_le, statut,
        oeuvres(id, titre, couverture_url, resume, profiles(nom))
      `)
      .eq('emprunteur_id', userId)
      .eq('statut', 'actif')
      .order('expire_le', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /* Annonces d'occasion pour un livre (P4 #14). Les annonces sont rattachées
     à `livres.id`, pas à `oeuvre_id` directement : on retrouve la fiche livre
     de l'œuvre (créée par l'auteur, cf. synchroniserLivrePublication), puis
     on liste ses offres de type occasion. */
  async getOffresOccasion(oeuvreId) {
    if (!oeuvreId) return [];

    const { data: livre } = await supabase
      .from('livres')
      .select('id')
      .eq('oeuvre_id', oeuvreId)
      .maybeSingle();
    if (!livre?.id) return [];

    const { data, error } = await supabase
      .from('livre_offres')
      .select('id, prix, devise, vendeur_id, conditions, created_at')
      .eq('livre_id', livre.id)
      .eq('type', 'occasion')
      .eq('statut', 'active')
      .order('prix', { ascending: true });

    if (error) { console.warn('Offres occasion indisponibles :', error); return []; }
    return data || [];
  },

  /* Réserve une annonce d'occasion : crée la commande sous séquestre
     (RPC SECURITY DEFINER, V012) et renvoie son id. */
  async reserverOccasion(offreId, { modeRemise = 'main_propre', remiseInfos = {} } = {}) {
    const { data, error } = await supabase.rpc('creer_commande_occasion', {
      p_offre_id: offreId,
      p_mode_remise: modeRemise,
      p_remise_infos: remiseInfos,
    });
    if (error) throw new Error(error.message || 'Réservation impossible.');
    return data;
  },

  /* Toutes les annonces d'occasion actives, tous livres confondus (reste P4 #14 :
     jusqu'ici on ne pouvait voir que les annonces liées à une fiche œuvre précise). */
  async getToutesAnnoncesOccasion({ limit = 40, offset = 0 } = {}) {
    const { data, error } = await supabase
      .from('livre_offres')
      .select('id, prix, devise, conditions, created_at, livres(id, titre, couverture_url, oeuvre_id)')
      .eq('type', 'occasion')
      .eq('statut', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  },

  async getRailsMarchands({ limit = 10 } = {}) {
    const [populaires, nouveautes, gratuits, premium] = await Promise.all([
      this.getOeuvres({ limit, tri: 'lectures', exclureSysteme: true }).catch(() => ({ data: [] })),
      this.getOeuvres({ limit, tri: 'recent', exclureSysteme: true }).catch(() => ({ data: [] })),
      this.getOeuvres({ limit, tri: 'recent', statut: 'gratuit', exclureSysteme: true }).catch(() => ({ data: [] })),
      this.getOeuvres({ limit, tri: 'recent', statut: 'premium', exclureSysteme: true }).catch(() => ({ data: [] })),
    ]);

    return [
      { id: 'populaires', titre: 'Les plus lus', sousTitre: 'Ce que les lecteurs ouvrent en premier', oeuvres: populaires.data || [] },
      { id: 'nouveautes', titre: 'Nouveautés auteurs', sousTitre: 'Les publications récentes de la communauté', oeuvres: nouveautes.data || [] },
      { id: 'gratuits', titre: 'À lire gratuitement', sousTitre: 'Commencer sans paiement, sauvegarder hors ligne ensuite', oeuvres: gratuits.data || [] },
      { id: 'premium', titre: 'Premium avec extraits', sousTitre: 'Lire une partie, puis payer via Fapshi pour continuer', oeuvres: premium.data || [] },
    ].filter(rail => rail.oeuvres.length);
  },

  async getOeuvresAuteur(auteurId) {
    const { data, error } = await supabase
      .from('oeuvres')
      .select('*')
      .eq('auteur_id', auteurId)
      .eq('visible', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async creerOeuvre(champs) {
    let { data, error } = await supabase
      .from('oeuvres')
      .insert(champs)
      .select()
      .single();
    if (error && colonneManquante(error, 'chapitres_gratuits')) {
      const retry = await supabase
        .from('oeuvres')
        .insert(sansChamp(champs, 'chapitres_gratuits'))
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    return data;
  },

  async notifierNouvelleOeuvre(oeuvreId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifie.');

    const res = await fetch('/api/notify-publication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ oeuvreId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Erreur notification publication.');
    return json;
  },

  async updateOeuvre(id, champs) {
    let { data, error } = await supabase
      .from('oeuvres')
      .update({ ...champs, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error && colonneManquante(error, 'chapitres_gratuits')) {
      const retry = await supabase
        .from('oeuvres')
        .update({ ...sansChamp(champs, 'chapitres_gratuits'), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    return data;
  },

  async supprimerOeuvre(id) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifié.');

    const { error: updateError } = await supabase
      .from('oeuvres')
      .update({ visible: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('auteur_id', session.user.id)
      .select('id')
      .single();
    if (!updateError) return;

    console.warn('Suppression directe indisponible, fallback RPC.', updateError);

    const { error: rpcError } = await supabase.rpc('supprimer_oeuvre', { p_oeuvre_id: id });
    if (!rpcError) return;

    console.warn('RPC supprimer_oeuvre indisponible, fallback Pages Function.', rpcError);

    // Fallback historique via Pages Function server-side.
    const res = await fetch('/api/delete-oeuvre', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ oeuvreId: id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || rpcError.message || 'Erreur suppression.');
  },

  async incrementerLectures(oeuvreId) {
    await supabase.rpc('increment_lectures', { oeuvre_id: oeuvreId });
    // Pas de fallback — si la fonction RPC n'existe pas, on ignore silencieusement
  },

  /* ---- Chapitres ---------------------------------------- */

  async getChapitres(oeuvreId, { inclureNonPublies = false } = {}) {
    let query = supabase
      .from('chapitres')
      .select('id, numero, titre, chapitre_id, source_hash, type_element, visible, date_publication, created_at')
      .eq('oeuvre_id', oeuvreId)
      .order('numero');
    if (!inclureNonPublies) {
      query = query
        .eq('visible', true)
        .or(`date_publication.is.null,date_publication.lte.${new Date().toISOString()}`);
    }
    let { data, error } = await query;
    if (error && (
      colonneManquante(error, 'date_publication')
      || colonneManquante(error, 'visible')
      || colonneManquante(error, 'type_element')
      || colonneManquante(error, 'chapitre_id')
      || colonneManquante(error, 'source_hash')
    )) {
      const retry = await supabase
        .from('chapitres')
        .select('id, numero, titre, created_at')
        .eq('oeuvre_id', oeuvreId)
        .order('numero');
      data = (retry.data || []).map(ch => ({ ...ch, visible: true, date_publication: null, type_element: 'chapitre' }));
      error = retry.error;
    }
    if (error) throw error;
    return data;
  },

  async getChapitre(chapitreId) {
    let { data, error } = await supabase
      .from('chapitres')
      .select('id, oeuvre_id, numero, titre, contenu, contenu_texte, chapitre_id, source_hash, type_element, visible, date_publication')
      .eq('id', chapitreId)
      .single();
    if (error && colonneManquante(error, 'contenu')) {
      const retry = await supabase
        .from('chapitres')
        .select('id, oeuvre_id, numero, titre, contenu_texte, chapitre_id, source_hash, type_element, visible, date_publication')
        .eq('id', chapitreId)
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error && (colonneManquante(error, 'chapitre_id') || colonneManquante(error, 'source_hash'))) {
      const retry = await supabase
        .from('chapitres')
        .select('id, oeuvre_id, numero, titre, contenu_texte, type_element, visible, date_publication')
        .eq('id', chapitreId)
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    return { ...data, contenu_texte: data?.contenu_texte || data?.contenu || '' };
  },

  async getChapitresOffline(oeuvreId) {
    let { data, error } = await supabase
      .from('chapitres')
      .select('id, numero, titre, contenu, contenu_texte, chapitre_id, source_hash, visible, date_publication')
      .eq('oeuvre_id', oeuvreId)
      .eq('visible', true)
      .or(`date_publication.is.null,date_publication.lte.${new Date().toISOString()}`)
      .order('numero');
    if (error && (
      colonneManquante(error, 'contenu')
      || colonneManquante(error, 'date_publication')
      || colonneManquante(error, 'visible')
      || colonneManquante(error, 'chapitre_id')
      || colonneManquante(error, 'source_hash')
    )) {
      const retry = await supabase
        .from('chapitres')
        .select('id, numero, titre, contenu_texte')
        .eq('oeuvre_id', oeuvreId)
        .order('numero');
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    return (data || []).map(ch => ({
      id: ch.id,
      numero: ch.numero,
      titre: ch.titre,
      chapitre_id: ch.chapitre_id || ch.id,
      source_hash: ch.source_hash || null,
      contenu: ch.contenu || ch.contenu_texte || '',
    }));
  },

  async creerChapitre(champs) {
    let { data, error } = await supabase
      .from('chapitres')
      .insert(champs)
      .select()
      .single();
    if (error && erreurColonnesNormalisationManquantes(error) && contientColonnesNormalisation(champs)) {
      const champsCompat = { ...champs };
      delete champsCompat.chapitre_id;
      delete champsCompat.format_source;
      delete champsCompat.source_hash;
      delete champsCompat.structure_path;
      delete champsCompat.epub_href;
      delete champsCompat.metadata;
      const retry = await supabase
        .from('chapitres')
        .insert(champsCompat)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    return data;
  },

  async getEditionEpub(oeuvreId) {
    let { data, error } = await supabase
      .from('livre_editions')
      .select('id, livre_id, source_oeuvre_id, format, statut, fichier_url, epub_url, livres!inner(oeuvre_id)')
      .eq('format', 'epub')
      .eq('statut', 'active')
      .eq('livres.oeuvre_id', oeuvreId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      const retry = await supabase
        .from('livre_editions')
        .select('id, livre_id, source_oeuvre_id, format, statut, fichier_url, epub_url')
        .eq('format', 'epub')
        .eq('source_oeuvre_id', oeuvreId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('Edition EPUB indisponible :', error);
      return null;
    }

    return data || null;
  },

  async synchroniserLivrePublication(oeuvre, { chapitres = [], fichierOriginal = null, cheminFichier = null, epubPath = null } = {}) {
    if (!oeuvre?.id || !oeuvre?.auteur_id) return null;

    const livrePayload = {
      oeuvre_id: oeuvre.id,
      auteur_id: oeuvre.auteur_id,
      titre: oeuvre.titre,
      sous_titre: oeuvre.sous_titre || null,
      description: oeuvre.resume || null,
      langue_originale: oeuvre.langue_originale || 'fr',
      isbn13: oeuvre.isbn || null,
      couverture_url: oeuvre.couverture_url || null,
      public_cible: oeuvre.public_cible || 'tous',
      mots_cles: oeuvre.mots_cles || [],
      statut: oeuvre.visible === false ? 'retire' : 'actif',
      type_catalogue: 'auto_edition',
      metadata: {
        source: 'publication_kalamundi',
        hash_sha256: oeuvre.hash_sha256 || null,
        standards: 'kalamundi_kdp_like_v1',
        ...oeuvre.metadata_publication,
      },
    };

    const { data: livre, error: livreError } = await supabase
      .from('livres')
      .upsert(livrePayload, { onConflict: 'oeuvre_id' })
      .select()
      .single();
    if (livreError) {
      console.warn('Livre non synchronisé :', livreError);
      return null;
    }

    const extOriginale = fichierOriginal?.name?.split('.').pop()?.toLowerCase() || 'interne';
    const editions = [
      {
        livre_id: livre.id,
        source_oeuvre_id: oeuvre.id,
        format: 'chapitres',
        statut: 'active',
        version: '1.0',
        fichier_url: cheminFichier || null,
        nb_chapitres: chapitres.length,
        metadata: {
          format_source: extOriginale,
          normalisation: 'chapitres_internes',
          standards: 'kalamundi_kdp_like_v1',
        },
      },
    ];

    if (epubPath) {
      editions.push({
        livre_id: livre.id,
        source_oeuvre_id: oeuvre.id,
        format: 'epub',
        statut: 'active',
        version: '1.0',
        fichier_url: epubPath,
        epub_url: epubPath,
        nb_chapitres: chapitres.length,
        metadata: {
          generated_by: 'kalamundi_epub_builder',
          canonical: true,
          format_source: extOriginale,
          standards: 'kalamundi_kdp_like_v1',
        },
      });
    }

    const { data: editionsCreees, error: editionsError } = await supabase
      .from('livre_editions')
      .upsert(editions, { onConflict: 'livre_id,format,source_oeuvre_id' })
      .select();
    if (editionsError) console.warn('Éditions non synchronisées :', editionsError);

    const editionChapitres = (editionsCreees || []).find(e => e.format === 'chapitres') || null;
    const offreType = oeuvre.statut === 'premium' ? 'achat_numerique' : 'lecture_gratuite';
    const offrePayload = {
      livre_id: livre.id,
      edition_id: editionChapitres?.id || null,
      source_oeuvre_id: oeuvre.id,
      vendeur_id: oeuvre.auteur_id,
      type: offreType,
      statut: 'active',
      prix: oeuvre.statut === 'premium' ? Number(oeuvre.prix || 0) : 0,
      devise: 'XAF',
      fapshi_enabled: oeuvre.statut === 'premium',
      chapitres_gratuits: Number(oeuvre.chapitres_gratuits || 0),
      royalties_auteur_pct: oeuvre.statut === 'premium' ? 50 : 0,
      royalties_plateforme_pct: oeuvre.statut === 'premium' ? 50 : 0,
      ordre: oeuvre.statut === 'premium' ? 20 : 10,
    };

    const { error: offreError } = await supabase
      .from('livre_offres')
      .upsert(offrePayload, { onConflict: 'source_oeuvre_id,type' });
    if (offreError) console.warn('Offre non synchronisée :', offreError);

    return { livre, editions: editionsCreees || [] };
  },

  async updateChapitre(id, champs) {
    const { data, error } = await supabase
      .from('chapitres')
      .update(champs)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async supprimerChapitre(id) {
    const { error } = await supabase.from('chapitres').delete().eq('id', id);
    if (error) throw error;
  },

  /* ---- Traductions -------------------------------------- */

  async getTraduction(chapitreRef, langueCible, { chapitreId = null } = {}) {
    let { data, error } = await supabase
      .from('traductions')
      .select('contenu_traduit')
      .eq('chapitre_ref', chapitreRef)
      .eq('langue_cible', langueCible)
      .maybeSingle();
    if (error && colonneManquante(error, 'chapitre_ref')) {
      const retry = await supabase
        .from('traductions')
        .select('contenu_traduit')
        .eq('chapitre_id', chapitreId || chapitreRef)
        .eq('langue_cible', langueCible)
        .maybeSingle();
      data = retry.data;
    }
    return data;
  },

  async saveTraduction(chapitreRef, langueCible, contenuTraduit, { chapitreId = null, langueSource = 'fr', sourceHash = null } = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // skip silencieux si non authentifié (RLS bloquerait de toute façon)
    let { error } = await supabase
      .from('traductions')
      .upsert({
        chapitre_id:     chapitreId || chapitreRef,
        chapitre_ref:    chapitreRef,
        langue_source:   langueSource,
        source_hash:     sourceHash,
        langue_cible:    langueCible,
        contenu_traduit: contenuTraduit,
      }, { onConflict: 'chapitre_ref,langue_cible' });
    if (error && colonneManquante(error, 'chapitre_ref')) {
      const retry = await supabase
        .from('traductions')
        .upsert({
          chapitre_id:     chapitreId || chapitreRef,
          langue_cible:    langueCible,
          contenu_traduit: contenuTraduit,
        }, { onConflict: 'chapitre_id,langue_cible' });
      error = retry.error;
    }
    if (error) throw error;
  },

  /* ---- Lectures (progression) --------------------------- */

  async getProgression(userId, oeuvreId) {
    const { data } = await supabase
      .from('lectures')
      .select('chapitre_courant, page_courante, session_id')
      .eq('user_id', userId)
      .eq('oeuvre_id', oeuvreId)
      .single();
    return data;
  },

  async sauvegarderProgression(userId, oeuvreId, chapitreCourant, pageCourante, sessionId) {
    const { error } = await supabase
      .from('lectures')
      .upsert({
        user_id:          userId,
        oeuvre_id:        oeuvreId,
        chapitre_courant: chapitreCourant,
        page_courante:    pageCourante,
        session_id:       sessionId,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'user_id,oeuvre_id' });
    if (error) throw error;

    try {
      await supabase.from('oeuvre_etageres').upsert({
        user_id: userId,
        oeuvre_id: oeuvreId,
        statut: 'en_cours',
        progression_pct: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,oeuvre_id' });
    } catch {}
  },

  async sauvegarderProgressionEleve(userId, oeuvreId, classeId, chapitreNum, nbChapitres) {
    const pourcentage = nbChapitres > 0
      ? Math.min(100, Math.round((chapitreNum / nbChapitres) * 100))
      : 0;
    const { error } = await supabase
      .from('progression_eleves')
      .upsert({
        eleve_id:         userId,
        oeuvre_id:        oeuvreId,
        classe_id:        classeId,
        chapitre_lu:      chapitreNum,
        nb_chapitres:     nbChapitres,
        pourcentage,
        termine:          pourcentage >= 100,
        derniere_lecture: new Date().toISOString(),
      }, { onConflict: 'eleve_id,oeuvre_id,classe_id' });
    if (error) throw error;
  },

  async getBibliotheque(userId) {
    const { data, error } = await supabase
      .from('lectures')
      .select(`
        chapitre_courant, page_courante, updated_at,
        oeuvres(id, titre, genre, couverture_url, auteur_id,
          profiles!oeuvres_auteur_id_fkey(nom))
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /* ---- Couche sociale lecteur --------------------------- */

  async getStatsSocialesOeuvre(oeuvreId) {
    const fallback = {
      nbAvis: 0,
      noteMoyenne: 0,
      aLire: 0,
      enCours: 0,
      termines: 0,
      favoris: 0,
    };
    if (!oeuvreId) return fallback;

    const lireAvis = async () => {
      try {
        const result = await supabase
          .from('commentaires')
          .select('note', { count: 'exact' })
          .eq('oeuvre_id', oeuvreId)
          .not('note', 'is', null);
        if (result.error) throw result.error;
        return result;
      } catch {
        return { data: [], count: 0 };
      }
    };
    const lireEtageres = async () => {
      try {
        const { data, error } = await supabase.rpc('get_oeuvre_social_stats', { p_oeuvre_id: oeuvreId });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        return { data: [], compteurs: row || {} };
      } catch {
        return { data: [], compteurs: {} };
      }
    };
    const [avis, etageres] = await Promise.all([lireAvis(), lireEtageres()]);

    const notes = (avis.data || []).map(a => Number(a.note || 0)).filter(Boolean);
    const stats = { ...fallback, nbAvis: avis.count || notes.length };
    stats.noteMoyenne = notes.length
      ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10
      : 0;

    stats.aLire = Number(etageres.compteurs?.a_lire || 0);
    stats.enCours = Number(etageres.compteurs?.en_cours || 0);
    stats.termines = Number(etageres.compteurs?.termines || 0);
    stats.favoris = Number(etageres.compteurs?.favoris || 0);
    return stats;
  },

  async getEtagereOeuvre(userId, oeuvreId) {
    if (!userId || !oeuvreId) return null;
    const { data, error } = await supabase
      .from('oeuvre_etageres')
      .select('id, statut, progression_pct, updated_at')
      .eq('user_id', userId)
      .eq('oeuvre_id', oeuvreId)
      .maybeSingle();
    if (error) {
      console.warn('Étagère indisponible :', error);
      return null;
    }
    return data || null;
  },

  async setEtagereOeuvre(userId, oeuvreId, statut, progressionPct = 0) {
    if (!userId || !oeuvreId || !statut) return null;
    const { data, error } = await supabase
      .from('oeuvre_etageres')
      .upsert({
        user_id: userId,
        oeuvre_id: oeuvreId,
        statut,
        progression_pct: Math.max(0, Math.min(100, Number(progressionPct || 0))),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,oeuvre_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async retirerEtagereOeuvre(userId, oeuvreId) {
    if (!userId || !oeuvreId) return;
    const { error } = await supabase
      .from('oeuvre_etageres')
      .delete()
      .eq('user_id', userId)
      .eq('oeuvre_id', oeuvreId);
    if (error) throw error;
  },

  async getAchatsUtilisateur(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('paiements')
      .select(`
        id, oeuvre_id, montant, devise, statut, confirme_at, created_at,
        oeuvres(id, titre, genre, couverture_url, resume, auteur_id,
          profiles!oeuvres_auteur_id_fkey(nom))
      `)
      .eq('user_id', userId)
      .eq('statut', 'confirme')
      .not('oeuvre_id', 'is', null)
      .order('confirme_at', { ascending: false });
    if (error) {
      console.warn('Achats indisponibles :', error);
      return [];
    }
    return data || [];
  },

  /* ---- Commentaires & Notes ----------------------------- */

  async getCommentaires(oeuvreId) {
    let { data, error } = await supabase
      .from('commentaires')
      .select(`
        id, user_id, parent_id, contenu, note, created_at,
        profiles!commentaires_user_id_fkey(nom, photo_url)
      `)
      .eq('oeuvre_id', oeuvreId)
      .order('created_at', { ascending: true })
      .limit(120);
    if (error && colonneManquante(error, 'parent_id')) {
      const retry = await supabase
        .from('commentaires')
        .select(`
          id, user_id, contenu, note, created_at,
          profiles!commentaires_user_id_fkey(nom, photo_url)
        `)
        .eq('oeuvre_id', oeuvreId)
        .order('created_at', { ascending: false })
        .limit(80);
      data = (retry.data || []).map(c => ({ ...c, parent_id: null }));
      error = retry.error;
    }
    if (error) throw error;
    return data;
  },

  async ajouterCommentaire(userId, oeuvreId, contenu, note = null, parentId = null) {
    let { data, error } = await supabase
      .from('commentaires')
      .insert({ user_id: userId, oeuvre_id: oeuvreId, contenu, note, parent_id: parentId })
      .select(`id, user_id, parent_id, contenu, note, created_at,
               profiles!commentaires_user_id_fkey(nom, photo_url)`)
      .single();
    if (error && colonneManquante(error, 'parent_id')) {
      const retry = await supabase
        .from('commentaires')
        .insert({ user_id: userId, oeuvre_id: oeuvreId, contenu, note })
        .select(`id, user_id, contenu, note, created_at,
                 profiles!commentaires_user_id_fkey(nom, photo_url)`)
        .single();
      data = retry.data ? { ...retry.data, parent_id: null } : retry.data;
      error = retry.error;
    }
    if (error) throw error;

    // Recalculer la note moyenne via RPC (SECURITY DEFINER — bypass RLS)
    // Ne pas bloquer le retour si la mise à jour échoue
    if (note) {
      supabase.rpc('recalculer_note_oeuvre', { p_oeuvre_id: oeuvreId })
        .then(() => {})
        .catch(() => {}); // Silencieux — ne bloque pas
    }
    return data;
  },

  async supprimerCommentaire(id) {
    const { error } = await supabase.from('commentaires').delete().eq('id', id);
    if (error) throw error;
  },

  /* ---- Communautes -------------------------------------- */

  async getCommunautes({ recherche = '', limit = 30 } = {}) {
    let query = supabase
      .from('communautes')
      .select(`
        id, nom, slug, description, theme, langue, pays, image_url,
        created_at, createur_id,
        profiles!communautes_createur_id_fkey(nom, photo_url)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (recherche) query = query.or(`nom.ilike.%${recherche}%,description.ilike.%${recherche}%,theme.ilike.%${recherche}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async creerCommunaute(champs) {
    const slugBase = (champs.nom || 'communaute')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const { data, error } = await supabase
      .from('communautes')
      .insert({ ...champs, slug })
      .select()
      .single();
    if (error) throw error;
    await api.rejoindreCommunaute(data.id, champs.createur_id, 'moderateur').catch(() => {});
    return data;
  },

  async rejoindreCommunaute(communauteId, userId, role = 'membre') {
    const { data, error } = await supabase
      .from('communaute_membres')
      .upsert({ communaute_id: communauteId, user_id: userId, role }, { onConflict: 'communaute_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async quitterCommunaute(communauteId, userId) {
    const { error } = await supabase
      .from('communaute_membres')
      .delete()
      .eq('communaute_id', communauteId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async getMesCommunautes(userId) {
    const { data, error } = await supabase
      .from('communaute_membres')
      .select('communaute_id, role, communautes(id, nom, slug, theme, image_url)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getPostsCommunaute(communauteId, { limit = 30 } = {}) {
    const { data, error } = await supabase
      .from('communaute_posts')
      .select(`
        id, contenu, created_at, user_id, oeuvre_id,
        profiles!communaute_posts_user_id_fkey(nom, photo_url),
        oeuvres(id, titre, couverture_url)
      `)
      .eq('communaute_id', communauteId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async creerPostCommunaute(champs) {
    const { data, error } = await supabase
      .from('communaute_posts')
      .insert(champs)
      .select(`id, contenu, created_at, user_id, oeuvre_id,
               profiles!communaute_posts_user_id_fkey(nom, photo_url),
               oeuvres(id, titre, couverture_url)`)
      .single();
    if (error) throw error;
    return data;
  },

  /* ---- Revenus ------------------------------------------ */

  async getRevenus(auteurId) {
    const { data, error } = await supabase
      .from('revenus')
      .select('*, oeuvres(titre)')
      .eq('auteur_id', auteurId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getTotalRevenus(auteurId) {
    const { data, error } = await supabase
      .from('revenus')
      .select('montant, statut')
      .eq('auteur_id', auteurId);
    if (error) throw error;
    const total    = data.reduce((s, r) => s + Number(r.montant), 0);
    const en_attente = data.filter(r => r.statut === 'en_attente').reduce((s, r) => s + Number(r.montant), 0);
    return { total, en_attente };
  },

  async getReportingAuteur(auteurId) {
    const seuilPayout = 5000;
    const lireRevenus = async () => {
      try {
        const result = await supabase
          .from('revenus')
          .select('id, oeuvre_id, montant, statut, type, created_at, oeuvres(titre, statut, prix)')
          .eq('auteur_id', auteurId);
        if (result.error) throw result.error;
        return result;
      } catch {
        return { data: [] };
      }
    };
    const lireLectures = async () => {
      try {
        const result = await supabase
          .from('lectures')
          .select('user_id, oeuvre_id, chapitre_courant, page_courante, updated_at, oeuvres!inner(auteur_id, titre, statut, prix)')
          .eq('oeuvres.auteur_id', auteurId);
        if (result.error) throw result.error;
        return result;
      } catch {
        return { data: [] };
      }
    };
    const [revenusResult, lecturesResult] = await Promise.all([lireRevenus(), lireLectures()]);

    const revenus = revenusResult.data || [];
    const lectures = lecturesResult.data || [];
    const totalRevenus = revenus.reduce((s, r) => s + Number(r.montant || 0), 0);
    const revenusAttente = revenus
      .filter(r => r.statut === 'en_attente')
      .reduce((s, r) => s + Number(r.montant || 0), 0);
    const ventes = revenus.filter(r => ['premium', 'vente_premium'].includes(r.type)).length;
    const pagesSuivies = lectures.reduce((s, l) => s + Math.max(1, Number(l.page_courante || 1)), 0);
    const chapitresSuivis = lectures.reduce((s, l) => s + Math.max(1, Number(l.chapitre_courant || 1)), 0);
    const lecteursUniques = new Set(lectures.map(l => l.user_id).filter(Boolean)).size;

    return {
      ventes,
      totalRevenus,
      revenusAttente,
      seuilPayout,
      resteAvantPayout: Math.max(0, seuilPayout - revenusAttente),
      pagesSuivies,
      chapitresSuivis,
      lecteursUniques,
      selectActif: false,
      selectEligible: ventes > 0 || pagesSuivies >= 250,
    };
  },

  /* ---- Institutions ------------------------------------- */

  async getInstitution(userId) {
    const { data } = await supabase
      .from('institutions')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data;
  },

  async creerInstitution(champs) {
    const { data, error } = await supabase
      .from('institutions')
      .insert(champs)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /* ---- Signalements ------------------------------------- */

  async signalerOeuvre(userId, oeuvreId, motif) {
    const { error } = await supabase
      .from('signalements')
      .insert({ user_id: userId, oeuvre_id: oeuvreId, motif });
    if (error) throw error;
  },

  /* ---- Storage ------------------------------------------ */

  async uploadCouverture(oeuvreId, fichier) {
    const ext    = fichier.name.split('.').pop();
    const chemin = `oeuvres/${oeuvreId}/couverture.${ext}`;
    const { error } = await supabase.storage
      .from('couvertures')
      .upload(chemin, fichier, { upsert: true, contentType: fichier.type });
    if (error) throw error;
    const { data } = supabase.storage.from('couvertures').getPublicUrl(chemin);
    return `${data.publicUrl}?v=${Date.now()}`;
  },

  async uploadFichierOeuvre(oeuvreId, fichier) {
    const ext    = fichier.name.split('.').pop();
    const chemin = `oeuvres/${oeuvreId}/fichier.${ext}`;
    const { error } = await supabase.storage
      .from('oeuvres-privees')
      .upload(chemin, fichier, { upsert: true });
    if (error) throw error;
    return chemin;
  },

  async uploadEpubCanonique(oeuvreId, blob) {
    const chemin = `oeuvres/${oeuvreId}/canonique.epub`;
    const { error } = await supabase.storage
      .from('oeuvres-privees')
      .upload(chemin, blob, {
        upsert: true,
        contentType: 'application/epub+zip',
      });
    if (error) throw error;
    return chemin;
  },

  async getUrlFichierSecurise(chemin) {
    const { data, error } = await supabase.storage
      .from('oeuvres-privees')
      .createSignedUrl(chemin, 3600); // expire dans 1h
    if (error) throw error;
    return data.signedUrl;
  },

  /* ---- Recherche globale -------------------------------- */

  async rechercher(terme, { limit = 20 } = {}) {
    const { data, error } = await supabase
      .from('oeuvres')
      .select(`
        id, titre, genre, resume, couverture_url, langue_originale, statut,
        profiles!oeuvres_auteur_id_fkey(nom)
      `)
      .eq('visible', true)
      .or(`titre.ilike.%${terme}%,resume.ilike.%${terme}%,genre.ilike.%${terme}%`)
      .limit(limit);
    if (error) throw error;
    return data;
  },

  /* ---- Paiements ---------------------------------------- */

  async creerPaiement(champs) {
    const { data, error } = await supabase
      .from('paiements')
      .insert(champs)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMesPaiements(userId) {
    const { data, error } = await supabase
      .from('paiements')
      .select('*, oeuvres(titre)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async verifierAccesPremium(userId, oeuvreId) {
    const { data } = await supabase
      .from('acces_premium')
      .select('id, expire_le')
      .eq('user_id', userId)
      .eq('oeuvre_id', oeuvreId)
      .maybeSingle();
    if (data) {
      // Un prêt (emprunt_id renseigné) a un expire_le : accès révoqué une fois passé.
      // Un achat n'a pas d'expire_le → accès permanent.
      if (data.expire_le && new Date(data.expire_le) <= new Date()) return false;
      return true;
    }
    // Pas d'achat/prêt individuel : un abonné Reader+ ou Auteur Pro (qui inclut
    // Reader+) a un accès illimité aux œuvres premium — c'est la promesse vendue
    // sur /pages/abonnements.html, elle doit être honorée ici, pas seulement
    // affichée. Sans ce test, un abonné payant devait quand même acheter chaque
    // œuvre séparément (cf. ERROR_LOG).
    return this.aAbonnementActif(userId, ['reader_plus', 'auteur_pro']);
  },

  async aAbonnementActif(userId, plansValides) {
    const { data } = await supabase
      .from('profiles')
      .select('abonnement, abonnement_expire_at')
      .eq('id', userId)
      .maybeSingle();
    if (!data?.abonnement || !plansValides.includes(data.abonnement)) return false;
    if (data.abonnement_expire_at && new Date(data.abonnement_expire_at) <= new Date()) return false;
    return true;
  },

  async adminGetPaiements() {
    const { data, error } = await supabase
      .from('paiements')
      .select(`*, profiles!paiements_user_id_fkey(nom), oeuvres(titre)`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  },

  async adminConfirmerPaiement(id, oeuvreId, userId) {
    // 1. Marquer le paiement comme confirmé
    const { data: paiement, error } = await supabase
      .from('paiements')
      .update({ statut: 'confirme', confirme_at: new Date().toISOString() })
      .eq('id', id)
      .select('montant, devise, type')
      .single();
    if (error) throw error;

    // 2. Donner accès premium si c'est un achat d'œuvre
    if (oeuvreId) {
      await supabase
        .from('acces_premium')
        .upsert({ user_id: userId, oeuvre_id: oeuvreId, paiement_id: id },
          { onConflict: 'user_id,oeuvre_id' });

      // 3. Créer automatiquement l'entrée de revenu pour l'auteur (50% split)
      try {
        const { data: oeuvre } = await supabase
          .from('oeuvres')
          .select('auteur_id, titre')
          .eq('id', oeuvreId)
          .single();

        if (oeuvre?.auteur_id && paiement?.montant) {
          const partAuteur = Math.round(Number(paiement.montant) * SPLIT_AUTEUR_PREMIUM * 100) / 100;
          await supabase
            .from('revenus')
            .insert({
              auteur_id:  oeuvre.auteur_id,
              oeuvre_id:  oeuvreId,
              paiement_id: id,
              montant:    partAuteur,
              devise:     paiement.devise || 'USD',
              type:       'vente_premium',
              statut:     'en_attente',
            });
        }
      } catch { /* silencieux — ne bloque pas la confirmation du paiement */ }
    }
  },

  async adminRejeterPaiement(id) {
    const { error } = await supabase
      .from('paiements')
      .update({ statut: 'rejete' })
      .eq('id', id);
    if (error) throw error;
  },

  /* ---- Admin -------------------------------------------- */

  async adminGetStats() {
    const [oeuvres, users, signalements, institutions] = await Promise.all([
      supabase.from('oeuvres').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('signalements').select('id', { count: 'exact', head: true }).eq('statut', 'ouvert'),
      supabase.from('institutions').select('id', { count: 'exact', head: true }).eq('statut_verification', 'en_attente'),
    ]);
    return {
      totalOeuvres:        oeuvres.count  || 0,
      totalUsers:          users.count    || 0,
      signalementsOuverts: signalements.count || 0,
      institutionsAttente: institutions.count || 0,
    };
  },

  async adminGetOeuvres({ page = 1, limit = 20 } = {}) {
    const { data, error, count } = await supabase
      .from('oeuvres')
      .select(`id, titre, genre, statut, visible, nb_lectures, created_at,
               profiles!oeuvres_auteur_id_fkey(nom)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    return { data, total: count };
  },

  async adminToggleVisible(oeuvreId, visible) {
    const { error } = await supabase
      .from('oeuvres').update({ visible }).eq('id', oeuvreId);
    if (error) throw error;
  },

  async adminGetSignalements() {
    const { data, error } = await supabase
      .from('signalements')
      .select(`id, motif, statut, created_at,
               oeuvres(id, titre),
               profiles!signalements_user_id_fkey(nom)`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  },

  async adminTraiterSignalement(id, statut) {
    const { error } = await supabase
      .from('signalements').update({ statut }).eq('id', id);
    if (error) throw error;
  },

  /* ---- Arbitrage litiges occasion (reste P4 #14) --------- */

  async adminGetLitiges() {
    const { data: commandes, error } = await supabase
      .from('commandes_occasion')
      .select(`id, livre_id, acheteur_id, vendeur_id, montant_xaf, commission_xaf,
               montant_vendeur_xaf, litige_motif, statut, created_at, livres(titre)`)
      .eq('statut', 'litige')
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!commandes?.length) return [];

    const ids = [...new Set(commandes.flatMap(c => [c.acheteur_id, c.vendeur_id]))];
    const { data: profils } = await supabase.from('profiles').select('id, nom, telephone').in('id', ids);
    const parId = Object.fromEntries((profils || []).map(p => [p.id, p]));

    return commandes.map(c => ({
      ...c,
      acheteur: parId[c.acheteur_id] || null,
      vendeur: parId[c.vendeur_id] || null,
    }));
  },

  async adminResoudreLitige(commandeId, decision) {
    const { error } = await supabase.rpc('resoudre_litige', { p_commande_id: commandeId, p_decision: decision });
    if (error) throw new Error(error.message || 'Arbitrage impossible.');
  },

  /* ---- Promotions / prix barré (reste P3 #12, D17) -------- */

  async adminGetPromotions() {
    const { data, error } = await supabase
      .from('livre_offres')
      .select('id, prix, prix_barre, devise, livres(id, titre)')
      .eq('type', 'achat_numerique')
      .eq('statut', 'active')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  async adminDefinirPromo(offreId, prixBarre) {
    const { error } = await supabase
      .from('livre_offres')
      .update({ prix_barre: prixBarre })
      .eq('id', offreId);
    if (error) throw new Error(error.message || 'Mise à jour impossible.');
  },

  async adminGetInstitutions() {
    const { data, error } = await supabase
      .from('institutions')
      .select(`id, nom, type, pays, domaine, statut_verification, created_at,
               profiles!institutions_user_id_fkey(nom, email:id)`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  },

  async adminVerifierInstitution(id, statut) {
    const { error } = await supabase
      .from('institutions').update({ statut_verification: statut }).eq('id', id);
    if (error) throw error;
  },

  async adminGetUsers({ limit = 30 } = {}) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nom, role, niveau_auteur, badge_fondateur, created_at, pays')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async adminSetRole(userId, role) {
    const { error } = await supabase
      .from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
  },

  /* ---- Finance & Croissance ----------------------------- */

  async adminGetFinance() {
    const vide = { totalPaiements:0, totalKalamundi:0, totalAuteurs:0, mrr:0, totalUsers:0, topOeuvres:[], graphe: Array.from({length:12},(_,i)=>{ const d=new Date(new Date().getFullYear(),new Date().getMonth()-11+i,1); return {label:d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}),total:0}; }), usersParMois: Array.from({length:6},(_,i)=>{ const d=new Date(new Date().getFullYear(),new Date().getMonth()-5+i,1); return {label:d.toLocaleDateString('fr-FR',{month:'short'}),count:0}; }), topPays:[] };
    try {
    const [paiements, revenus, oeuvres, users] = await Promise.all([
      supabase.from('paiements')
        .select('montant, devise, type, statut, created_at')
        .eq('statut', 'confirme')
        .order('created_at', { ascending: true })
        .then(r => r.error ? { data: [] } : r),
      supabase.from('revenus')
        .select('montant, statut, created_at')
        .then(r => r.error ? { data: [] } : r),
      supabase.from('oeuvres')
        .select('id, titre, nb_lectures, genre, profiles!oeuvres_auteur_id_fkey(nom)')
        .order('nb_lectures', { ascending: false })
        .limit(10)
        .then(r => r.error ? { data: [] } : r),
      supabase.from('profiles')
        .select('id, created_at, pays, role')
        .order('created_at', { ascending: true })
        .then(r => r.error ? { data: [] } : r),
    ]);

    const now = new Date();
    const moisActuel = now.getMonth();
    const anneeActuelle = now.getFullYear();

    // Revenus Kalamundi = total paiements - part auteurs
    const totalPaiements = (paiements.data || []).reduce((s, p) => s + Number(p.montant || 0), 0);
    const totalAuteurs   = (revenus.data   || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const totalKalamundi = totalPaiements - totalAuteurs;

    // MRR — paiements du mois en cours
    const mrr = (paiements.data || [])
      .filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === moisActuel && d.getFullYear() === anneeActuelle;
      })
      .reduce((s, p) => s + Number(p.montant || 0), 0);

    // Graphe 12 derniers mois
    const graphe = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(anneeActuelle, moisActuel - i, 1);
      const m = d.getMonth(); const y = d.getFullYear();
      const total = (paiements.data || [])
        .filter(p => { const pd = new Date(p.created_at); return pd.getMonth() === m && pd.getFullYear() === y; })
        .reduce((s, p) => s + Number(p.montant || 0), 0);
      graphe.push({
        label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        total: Math.round(total * 100) / 100,
      });
    }

    // Croissance users par mois (6 derniers mois)
    const usersParMois = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anneeActuelle, moisActuel - i, 1);
      const m = d.getMonth(); const y = d.getFullYear();
      const count = (users.data || []).filter(u => {
        const ud = new Date(u.created_at);
        return ud.getMonth() === m && ud.getFullYear() === y;
      }).length;
      usersParMois.push({ label: d.toLocaleDateString('fr-FR', { month: 'short' }), count });
    }

    // Top pays
    const paysCount = {};
    (users.data || []).forEach(u => {
      if (u.pays) paysCount[u.pays] = (paysCount[u.pays] || 0) + 1;
    });
    const topPays = Object.entries(paysCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([pays, count]) => ({ pays, count }));

    return {
      totalPaiements: Math.round(totalPaiements * 100) / 100,
      totalKalamundi: Math.round(totalKalamundi * 100) / 100,
      totalAuteurs:   Math.round(totalAuteurs   * 100) / 100,
      mrr:            Math.round(mrr * 100) / 100,
      totalUsers:     (users.data || []).length,
      topOeuvres:     oeuvres.data || [],
      graphe,
      usersParMois,
      topPays,
    };
    } catch(e) { console.warn('adminGetFinance fallback:', e); return vide; }
  },

  async adminGetOwnerInsights() {
    const fallback = {
      generatedAt: new Date().toISOString(),
      kpis: {},
      segments: {},
      lists: {},
      exports: {},
    };
    try {
      const [users, oeuvres, paiements, revenus, commentaires, communautes, posts, bannieres] = await Promise.all([
        supabase.from('profiles')
          .select('id, email, nom, role, pays, ville, langue_preferee, niveau_auteur, badge_fondateur, compte_verifie, created_at, abonnement')
          .then(r => r.error ? { data: [] } : r),
        supabase.from('oeuvres')
          .select('id, titre, genre, langue_originale, statut, prix, nb_lectures, note_moyenne, public_cible, visible, created_at, auteur_id, profiles!oeuvres_auteur_id_fkey(nom, pays)')
          .then(r => r.error ? { data: [] } : r),
        supabase.from('paiements')
          .select('id, user_id, oeuvre_id, type, montant, devise, methode, statut, created_at, confirme_at')
          .then(r => r.error ? { data: [] } : r),
        supabase.from('revenus')
          .select('id, auteur_id, oeuvre_id, type, montant, devise, statut, created_at')
          .then(r => r.error ? { data: [] } : r),
        supabase.from('commentaires')
          .select('id, oeuvre_id, user_id, parent_id, note, created_at')
          .then(r => r.error ? { data: [] } : r),
        supabase.from('communautes')
          .select('id, nom, theme, pays, langue, created_at')
          .then(r => r.error ? { data: [] } : r),
        supabase.from('communaute_posts')
          .select('id, communaute_id, user_id, created_at')
          .then(r => r.error ? { data: [] } : r),
        supabase.from('pub_bannieres')
          .select('id, titre, page_cible, actif, impressions, clics, created_at')
          .then(r => r.error ? { data: [] } : r),
      ]);

      const now = new Date();
      const daysAgo = days => new Date(now.getTime() - days * 86400000);
      const inDays = (date, days) => date && new Date(date) >= daysAgo(days);
      const sum = rows => rows.reduce((s, r) => s + Number(r.montant || 0), 0);
      const groupCount = (rows, getter) => {
        const out = {};
        rows.forEach(r => {
          const key = getter(r) || 'Non renseigne';
          out[key] = (out[key] || 0) + 1;
        });
        return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
      };

      const allUsers = users.data || [];
      const allOeuvres = oeuvres.data || [];
      const allPaiements = paiements.data || [];
      const confirmedPayments = allPaiements.filter(p => p.statut === 'confirme');
      const allCommentaires = commentaires.data || [];
      const allBannieres = bannieres.data || [];

      const totalLectures = allOeuvres.reduce((s, o) => s + Number(o.nb_lectures || 0), 0);
      const premiumOeuvres = allOeuvres.filter(o => o.statut === 'premium');
      const paidUsers = new Set(confirmedPayments.map(p => p.user_id).filter(Boolean));
      const active30 = new Set([
        ...allCommentaires.filter(c => inDays(c.created_at, 30)).map(c => c.user_id),
        ...confirmedPayments.filter(p => inDays(p.created_at, 30)).map(p => p.user_id),
        ...allOeuvres.filter(o => inDays(o.created_at, 30)).map(o => o.auteur_id),
      ].filter(Boolean));

      const revenue30 = sum(confirmedPayments.filter(p => inDays(p.created_at, 30)));
      const revenue90 = sum(confirmedPayments.filter(p => inDays(p.created_at, 90)));
      const arpu = allUsers.length ? sum(confirmedPayments) / allUsers.length : 0;
      const conversion = allUsers.length ? (paidUsers.size / allUsers.length) * 100 : 0;
      const engagementRate = allUsers.length ? (active30.size / allUsers.length) * 100 : 0;

      const genres = groupCount(allOeuvres, o => o.genre);
      const paysUsers = groupCount(allUsers, u => u.pays);
      const roles = groupCount(allUsers, u => u.role);
      const langues = groupCount(allOeuvres, o => o.langue_originale);
      const statuts = groupCount(allOeuvres, o => o.statut);

      const lecturesParGenre = Object.values(allOeuvres.reduce((acc, o) => {
        const key = o.genre || 'Non renseigne';
        acc[key] ||= { genre: key, oeuvres: 0, lectures: 0, premium: 0 };
        acc[key].oeuvres += 1;
        acc[key].lectures += Number(o.nb_lectures || 0);
        if (o.statut === 'premium') acc[key].premium += 1;
        return acc;
      }, {})).sort((a, b) => b.lectures - a.lectures);

      const revenusParType = Object.values(confirmedPayments.reduce((acc, p) => {
        const key = p.type || 'autre';
        acc[key] ||= { type: key, transactions: 0, revenu: 0 };
        acc[key].transactions += 1;
        acc[key].revenu += Number(p.montant || 0);
        return acc;
      }, {})).sort((a, b) => b.revenu - a.revenu);

      const auteurs = Object.values(allOeuvres.reduce((acc, o) => {
        const id = o.auteur_id || 'unknown';
        acc[id] ||= {
          auteur_id: id,
          nom: o.profiles?.nom || 'Auteur inconnu',
          pays: o.profiles?.pays || '',
          oeuvres: 0,
          lectures: 0,
          premium: 0,
          note: 0,
          notes: 0,
        };
        acc[id].oeuvres += 1;
        acc[id].lectures += Number(o.nb_lectures || 0);
        if (o.statut === 'premium') acc[id].premium += 1;
        if (Number(o.note_moyenne || 0) > 0) {
          acc[id].note += Number(o.note_moyenne);
          acc[id].notes += 1;
        }
        return acc;
      }, {})).map(a => ({
        ...a,
        note_moyenne: a.notes ? Math.round((a.note / a.notes) * 10) / 10 : 0,
      })).sort((a, b) => b.lectures - a.lectures);

      const topOeuvres = [...allOeuvres]
        .sort((a, b) => Number(b.nb_lectures || 0) - Number(a.nb_lectures || 0))
        .slice(0, 50)
        .map(o => ({
          id: o.id,
          titre: o.titre,
          auteur: o.profiles?.nom || '',
          pays_auteur: o.profiles?.pays || '',
          genre: o.genre,
          langue: o.langue_originale,
          statut: o.statut,
          prix: o.prix,
          lectures: o.nb_lectures || 0,
          note: o.note_moyenne || 0,
          created_at: o.created_at,
        }));

      const adInventory = allBannieres.map(b => {
        const impressions = Number(b.impressions || 0);
        const clics = Number(b.clics || 0);
        return {
          titre: b.titre,
          page: b.page_cible || 'all',
          actif: !!b.actif,
          impressions,
          clics,
          ctr: impressions ? Math.round((clics / impressions) * 1000) / 10 : 0,
        };
      }).sort((a, b) => b.impressions - a.impressions);

      const marketableSegments = [
        ...paysUsers.slice(0, 8).map(p => ({
          segment: `Lecteurs ${p.label}`,
          taille: p.count,
          angle: 'Ciblage géographique pour éditeurs, écoles, annonceurs culturels',
        })),
        ...lecturesParGenre.slice(0, 8).map(g => ({
          segment: `Intérêt ${g.genre}`,
          taille: g.lectures,
          angle: 'Inventaire éditorial et sponsoring par genre',
        })),
        {
          segment: 'Utilisateurs actifs 30 jours',
          taille: active30.size,
          angle: 'Audience récente pour campagnes premium',
        },
        {
          segment: 'Acheteurs confirmés',
          taille: paidUsers.size,
          angle: 'Audience à forte intention commerciale',
        },
      ].filter(s => Number(s.taille || 0) > 0);

      return {
        generatedAt: now.toISOString(),
        kpis: {
          usersTotal: allUsers.length,
          active30: active30.size,
          engagementRate,
          paidUsers: paidUsers.size,
          conversion,
          totalOeuvres: allOeuvres.length,
          premiumOeuvres: premiumOeuvres.length,
          totalLectures,
          commentsTotal: allCommentaires.length,
          repliesTotal: allCommentaires.filter(c => c.parent_id).length,
          revenue30,
          revenue90,
          arpu,
          confirmedRevenue: sum(confirmedPayments),
          authorPayouts: sum(revenus.data || []),
          communities: (communautes.data || []).length,
          communityPosts: (posts.data || []).length,
        },
        segments: {
          paysUsers,
          roles,
          genres,
          langues,
          statuts,
          lecturesParGenre,
          revenusParType,
          marketableSegments,
        },
        lists: {
          topOeuvres,
          topAuteurs: auteurs.slice(0, 50),
          adInventory,
          recentPayments: confirmedPayments
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 100),
        },
        exports: {
          audience: allUsers.map(u => ({
            id: u.id,
            role: u.role,
            pays: u.pays,
            ville: u.ville,
            langue_preferee: u.langue_preferee,
            abonnement: u.abonnement,
            compte_verifie: u.compte_verifie,
            created_at: u.created_at,
          })),
          catalogue: topOeuvres,
          auteurs: auteurs,
          paiements: allPaiements.map(p => ({
            id: p.id,
            user_id: p.user_id,
            oeuvre_id: p.oeuvre_id,
            type: p.type,
            montant: p.montant,
            devise: p.devise,
            methode: p.methode,
            statut: p.statut,
            created_at: p.created_at,
          })),
          segments: marketableSegments,
        },
      };
    } catch (e) {
      console.warn('adminGetOwnerInsights fallback:', e);
      return fallback;
    }
  },

  /* ---- Régie publicitaire ------------------------------- */

  async pubGetBannieres() {
    const { data, error } = await supabase
      .from('pub_bannieres')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async pubGetBannierePage(page) {
    const { data } = await supabase
      .from('pub_bannieres')
      .select('id, image_url, lien_cible, texte_cta, titre')
      .eq('actif', true)
      .or(`page_cible.eq.all,page_cible.eq.${page}`)
      .limit(3);
    return data || [];
  },

  async pubCreerBanniere(champs) {
    const { data, error } = await supabase
      .from('pub_bannieres').insert(champs).select().single();
    if (error) throw error;
    return data;
  },

  async pubUpdateBanniere(id, champs) {
    const { error } = await supabase
      .from('pub_bannieres').update(champs).eq('id', id);
    if (error) throw error;
  },

  async pubSupprimerBanniere(id) {
    const { error } = await supabase
      .from('pub_bannieres').delete().eq('id', id);
    if (error) throw error;
  },

  async pubEnregistrerImpression(id) {
    await supabase.rpc('incrementer_impressions', { banniere_id: id }).catch(() => {});
  },

  async pubEnregistrerClic(id) {
    await supabase.rpc('incrementer_clics', { banniere_id: id }).catch(() => {});
  },

  /* ---- Configuration plateforme ------------------------- */

  async configGetAll() {
    const { data, error } = await supabase
      .from('config_plateforme').select('*').order('cle');
    if (error) throw error;
    return data || [];
  },

  async configGet(cle) {
    const { data } = await supabase
      .from('config_plateforme').select('valeur').eq('cle', cle).single();
    return data?.valeur ?? null;
  },

  async configSet(cle, valeur) {
    const { error } = await supabase
      .from('config_plateforme')
      .upsert({ cle, valeur, updated_at: new Date().toISOString() }, { onConflict: 'cle' });
    if (error) throw error;
  },

  /* ---- Annotations (marque-pages, notes, surlignages) -- */

  async getAnnotations(userId, oeuvreId) {
    const { data, error } = await supabase
      .from('annotations')
      .select('*')
      .eq('user_id', userId)
      .eq('oeuvre_id', oeuvreId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async creerAnnotation(champs) {
    const { data, error } = await supabase
      .from('annotations')
      .insert(champs)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAnnotation(id, champs) {
    const { data, error } = await supabase
      .from('annotations')
      .update({ ...champs, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async supprimerAnnotation(id) {
    const { error } = await supabase
      .from('annotations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async upsertMarquePage(userId, oeuvreId, chapitreId, chapitreNum, label = null) {
    const { data, error } = await supabase
      .from('annotations')
      .upsert({
        user_id:     userId,
        oeuvre_id:   oeuvreId,
        chapitre_id: chapitreId,
        chapitre_num: chapitreNum,
        type:        'marque_page',
        label,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'user_id,chapitre_id', ignoreDuplicates: false })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /* ---- Nouveaux auteurs (accueil) ----------------------- */

  async getNouveauxAuteurs({ limit = 6 } = {}) {
    // Auteurs ayant au moins 1 œuvre visible, triés par date d'inscription
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, nom, photo_url, pays, bio, niveau_auteur, badge_fondateur, created_at,
        oeuvres!oeuvres_auteur_id_fkey(id, titre, genre, couverture_url, nb_lectures, created_at)
      `)
      .neq('id', '00000000-0000-0000-0000-000000000001')
      .order('created_at', { ascending: false })
      .limit(limit * 3); // surcharger pour filtrer ceux sans œuvre

    if (error) throw error;

    // Garder uniquement les auteurs avec au moins 1 œuvre visible
    const avec_oeuvres = (data || [])
      .filter(p => p.oeuvres?.length > 0)
      .slice(0, limit)
      .map(p => ({
        ...p,
        // Garder la dernière œuvre publiée
        derniere_oeuvre: p.oeuvres.sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        )[0],
      }));

    return avec_oeuvres;
  },

  async getOeuvresPremiersPas({ limit = 8 } = {}) {
    // Œuvres récentes gratuites d'auteurs ayant peu de publications
    const { data, error } = await supabase
      .from('oeuvres')
      .select(`
        id, titre, genre, couverture_url, nb_lectures, created_at, langue_originale,
        profiles!oeuvres_auteur_id_fkey(id, nom, photo_url, pays, niveau_auteur)
      `)
      .eq('visible', true)
      .eq('statut', 'gratuit')
      .neq('auteur_id', '00000000-0000-0000-0000-000000000001')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /* ---- Stats dashboard auteur --------------------------- */

  async getStatsAuteur(auteurId) {
    let oeuvresQuery = supabase
        .from('oeuvres')
        .select('id, titre, genre, couverture_url, nb_lectures, note_moyenne, statut, prix, chapitres_gratuits, visible, created_at')
        .eq('auteur_id', auteurId)
        .eq('visible', true);
    let oeuvres = await oeuvresQuery;
    if (oeuvres.error && colonneManquante(oeuvres.error, 'chapitres_gratuits')) {
      oeuvres = await supabase
        .from('oeuvres')
        .select('id, titre, genre, couverture_url, nb_lectures, note_moyenne, statut, prix, visible, created_at')
        .eq('auteur_id', auteurId)
        .eq('visible', true);
      if (oeuvres.data) oeuvres.data = oeuvres.data.map(o => ({ ...o, chapitres_gratuits: 0 }));
    }
    const [, revenus, reporting] = await Promise.all([
      Promise.resolve(oeuvres),
      api.getTotalRevenus(auteurId),
      api.getReportingAuteur(auteurId),
    ]);
    if (oeuvres.error) throw oeuvres.error;

    const totalLectures = oeuvres.data.reduce((s, o) => s + (o.nb_lectures || 0), 0);
    return {
      nbOeuvres:     oeuvres.data.length,
      totalLectures,
      revenus,
      reporting,
      oeuvres:       oeuvres.data,
    };
  },

};

export default api;
