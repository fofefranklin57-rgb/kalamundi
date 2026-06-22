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

  async getOeuvres({ page = 1, limit = 20, genre, langue, statut, recherche, tri = 'recent' } = {}) {
    const orderCol = tri === 'lectures' ? 'nb_lectures' : 'created_at';
    let query = supabase
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

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, total: count };
  },

  async getOeuvre(id) {
    const { data, error } = await supabase
      .from('oeuvres')
      .select(`
        *, frequence_publication, date_debut_publication,
        profiles!oeuvres_auteur_id_fkey(id, nom, photo_url, pays, bio, niveau_auteur, badge_fondateur)
      `)
      .eq('id', id)
      .eq('visible', true)
      .single();
    if (error) throw error;
    return data;
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
    const { data, error } = await supabase
      .from('oeuvres')
      .insert(champs)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateOeuvre(id, champs) {
    const { data, error } = await supabase
      .from('oeuvres')
      .update({ ...champs, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async supprimerOeuvre(id) {
    const { error } = await supabase
      .from('oeuvres')
      .update({ visible: false })
      .eq('id', id);
    if (error) throw error;
  },

  async incrementerLectures(oeuvreId) {
    await supabase.rpc('increment_lectures', { oeuvre_id: oeuvreId });
    // Pas de fallback — si la fonction RPC n'existe pas, on ignore silencieusement
  },

  /* ---- Chapitres ---------------------------------------- */

  async getChapitres(oeuvreId) {
    const { data, error } = await supabase
      .from('chapitres')
      .select('id, numero, titre, created_at')
      .eq('oeuvre_id', oeuvreId)
      .order('numero');
    if (error) throw error;
    return data;
  },

  async getChapitre(chapitreId) {
    const { data, error } = await supabase
      .from('chapitres')
      .select('*')
      .eq('id', chapitreId)
      .single();
    if (error) throw error;
    return data;
  },

  async creerChapitre(champs) {
    const { data, error } = await supabase
      .from('chapitres')
      .insert(champs)
      .select()
      .single();
    if (error) throw error;
    return data;
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

  async getTraduction(chapitreId, langueCible) {
    const { data } = await supabase
      .from('traductions')
      .select('contenu_traduit')
      .eq('chapitre_id', chapitreId)
      .eq('langue_cible', langueCible)
      .maybeSingle();
    return data;
  },

  async saveTraduction(chapitreId, langueCible, contenuTraduit) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // skip silencieux si non authentifié (RLS bloquerait de toute façon)
    const { error } = await supabase
      .from('traductions')
      .upsert({
        chapitre_id:     chapitreId,
        langue_cible:    langueCible,
        contenu_traduit: contenuTraduit,
      }, { onConflict: 'chapitre_id,langue_cible' });
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

  /* ---- Commentaires & Notes ----------------------------- */

  async getCommentaires(oeuvreId) {
    const { data, error } = await supabase
      .from('commentaires')
      .select(`
        id, contenu, note, created_at,
        profiles!commentaires_user_id_fkey(nom, photo_url)
      `)
      .eq('oeuvre_id', oeuvreId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async ajouterCommentaire(userId, oeuvreId, contenu, note = null) {
    const { data, error } = await supabase
      .from('commentaires')
      .insert({ user_id: userId, oeuvre_id: oeuvreId, contenu, note })
      .select(`id, contenu, note, created_at,
               profiles!commentaires_user_id_fkey(nom, photo_url)`)
      .single();
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
    return data.publicUrl;
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
      .select('id')
      .eq('user_id', userId)
      .eq('oeuvre_id', oeuvreId)
      .single();
    return !!data;
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
    const [oeuvres, revenus] = await Promise.all([
      supabase
        .from('oeuvres')
        .select('id, titre, nb_lectures, note_moyenne, statut, visible')
        .eq('auteur_id', auteurId),
      api.getTotalRevenus(auteurId),
    ]);
    if (oeuvres.error) throw oeuvres.error;

    const totalLectures = oeuvres.data.reduce((s, o) => s + (o.nb_lectures || 0), 0);
    return {
      nbOeuvres:     oeuvres.data.length,
      totalLectures,
      revenus,
      oeuvres:       oeuvres.data,
    };
  },

};

export default api;
