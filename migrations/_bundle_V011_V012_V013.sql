-- ============================================================
-- BUNDLE À APPLIQUER SUR SUPABASE KALAMUNDI (projet iobieffnaauecyukecds)
-- Ordre : V011 (cadeaux) -> V012 (occasion/séquestre) -> V013 (annonce)
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE) : ré-exécutable sans risque.
-- ============================================================

-- ========== V011 ==========
-- ============================================================
-- V011 — Cadeaux diaspora (D11)
-- Objectif : permettre à la diaspora d'OFFRIR un livre à un proche
-- resté au pays. Le cadeau est un achat payé dont l'accès est mis en
-- attente jusqu'à ce qu'un bénéficiaire le réclame avec un code.
--
-- Modèle : un achat = une ligne dans acces_premium. Un cadeau ne crée
-- donc PAS d'acces_premium pour l'acheteur : il en crée un pour celui
-- qui réclame le code.
-- ============================================================

CREATE TABLE IF NOT EXISTS cadeaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qui offre
  offreur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ce qui est offert
  oeuvre_id UUID NOT NULL REFERENCES oeuvres(id) ON DELETE CASCADE,

  -- Le code que le bénéficiaire saisira (unique, non devinable)
  code TEXT NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 8 AND 24),

  -- Destinataire prévu (facultatif : on peut offrir "au porteur du code")
  beneficiaire_contact TEXT,
  message TEXT CHECK (message IS NULL OR char_length(message) <= 500),

  -- Traçabilité monétaire : on garde la devise payée ET l'équivalent XAF
  -- réellement encaissé par Fapshi (cf. scripts/lib/devises.mjs).
  montant NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (montant >= 0),
  devise TEXT NOT NULL DEFAULT 'XAF' CHECK (devise IN ('XAF', 'EUR', 'USD')),
  montant_xaf INT NOT NULL DEFAULT 0 CHECK (montant_xaf >= 0),
  paiement_id TEXT,

  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'paye', 'reclame', 'annule')),

  -- Qui a réclamé (rempli à la réclamation)
  reclame_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reclame_le TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Un cadeau réclamé doit dire par qui et quand ; un non-réclamé, non.
  CONSTRAINT cadeaux_reclamation_coherente CHECK (
    (statut = 'reclame' AND reclame_par IS NOT NULL AND reclame_le IS NOT NULL)
    OR (statut <> 'reclame' AND reclame_par IS NULL AND reclame_le IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cadeaux_offreur ON cadeaux(offreur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadeaux_statut ON cadeaux(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadeaux_paiement ON cadeaux(paiement_id);

ALTER TABLE cadeaux ENABLE ROW LEVEL SECURITY;

-- L'offreur voit ses cadeaux ; le bénéficiaire voit celui qu'il a réclamé.
-- Personne ne peut lister les codes des autres (sinon on les devine).
DROP POLICY IF EXISTS "cadeaux_lecture_offreur" ON cadeaux;
CREATE POLICY "cadeaux_lecture_offreur" ON cadeaux
  FOR SELECT USING (auth.uid() = offreur_id OR auth.uid() = reclame_par);

-- Aucune écriture directe depuis le client : le paiement et la réclamation
-- passent par le serveur / des RPC SECURITY DEFINER (cf. ERROR_LOG 2026-06-23).

CREATE OR REPLACE FUNCTION toucher_cadeaux_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cadeaux_updated_at ON cadeaux;
CREATE TRIGGER trg_cadeaux_updated_at
  BEFORE UPDATE ON cadeaux
  FOR EACH ROW EXECUTE FUNCTION toucher_cadeaux_updated_at();

-- ============================================================
-- RPC reclamer_cadeau — le bénéficiaire échange un code contre l'accès
-- SECURITY DEFINER : la vérification se fait ici, pas côté client.
-- ============================================================

CREATE OR REPLACE FUNCTION reclamer_cadeau(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cadeau   cadeaux%ROWTYPE;
  v_user_id  UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour reclamer un cadeau.';
  END IF;

  -- Verrou : deux personnes ne peuvent pas reclamer le meme code.
  SELECT * INTO v_cadeau
  FROM cadeaux
  WHERE code = upper(btrim(p_code))
  FOR UPDATE;

  IF v_cadeau.id IS NULL THEN
    RAISE EXCEPTION 'Code cadeau introuvable.';
  END IF;

  IF v_cadeau.statut = 'reclame' THEN
    RAISE EXCEPTION 'Ce cadeau a deja ete reclame.';
  END IF;

  IF v_cadeau.statut = 'annule' THEN
    RAISE EXCEPTION 'Ce cadeau a ete annule.';
  END IF;

  -- Un cadeau non paye ne donne aucun acces.
  IF v_cadeau.statut <> 'paye' THEN
    RAISE EXCEPTION 'Ce cadeau n''est pas encore paye.';
  END IF;

  -- On n'offre pas a soi-meme.
  IF v_cadeau.offreur_id = v_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas reclamer votre propre cadeau.';
  END IF;

  -- L'acces est accorde a celui qui reclame, pas a l'acheteur.
  INSERT INTO acces_premium (user_id, oeuvre_id)
  VALUES (v_user_id, v_cadeau.oeuvre_id)
  ON CONFLICT DO NOTHING;

  UPDATE cadeaux
     SET statut      = 'reclame',
         reclame_par = v_user_id,
         reclame_le  = now()
   WHERE id = v_cadeau.id;

  RETURN json_build_object(
    'ok', true,
    'oeuvre_id', v_cadeau.oeuvre_id,
    'message', v_cadeau.message
  );
END;
$$;

REVOKE ALL ON FUNCTION reclamer_cadeau(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclamer_cadeau(TEXT) TO authenticated;

-- ========== V012 ==========
-- ============================================================
-- V012 — Occasion : commandes sous séquestre + évaluations vendeur (P4 #14)
-- Objectif : vendre un livre d'occasion entre particuliers en toute confiance.
-- L'argent de l'acheteur est GELÉ (séquestre) au paiement et n'est versé au
-- vendeur qu'à la confirmation de réception (ou auto-libération après délai).
--
-- Le listing occasion existe déjà : livre_offres.type = 'occasion'.
-- États et règles : voir scripts/lib/occasion-etats.mjs (source de vérité).
-- Sur l'occasion, l'AUTEUR ne touche rien (première vente déjà effectuée).
-- ============================================================

CREATE TABLE IF NOT EXISTS commandes_occasion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  offre_id   UUID NOT NULL REFERENCES livre_offres(id) ON DELETE RESTRICT,
  livre_id   UUID NOT NULL REFERENCES livres(id) ON DELETE RESTRICT,
  acheteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendeur_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Montants (traçabilité : ce que paie l'acheteur, ce que touche le vendeur)
  montant_xaf         INT NOT NULL CHECK (montant_xaf >= 100),
  commission_xaf      INT NOT NULL DEFAULT 0 CHECK (commission_xaf >= 0),
  montant_vendeur_xaf INT NOT NULL DEFAULT 0 CHECK (montant_vendeur_xaf >= 0),
  devise TEXT NOT NULL DEFAULT 'XAF' CHECK (devise IN ('XAF','EUR','USD')),
  paiement_id TEXT,

  -- Séquestre : l'argent est-il encore gelé par la plateforme ?
  fonds_liberes BOOLEAN NOT NULL DEFAULT false,
  payout_statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (payout_statut IN ('en_attente','a_verser','verse','rembourse')),

  -- Logistique de proximité (démarrage léger : main propre ou point relais)
  mode_remise TEXT NOT NULL DEFAULT 'main_propre'
    CHECK (mode_remise IN ('main_propre','point_relais','livraison')),
  remise_infos JSONB NOT NULL DEFAULT '{}'::jsonb,  -- ville, point relais, créneau…

  statut TEXT NOT NULL DEFAULT 'en_attente_paiement'
    CHECK (statut IN (
      'en_attente_paiement','paye_sequestre','remis',
      'receptionne','clos','litige','annule','rembourse'
    )),
  litige_motif TEXT,

  paye_at        TIMESTAMPTZ,
  remis_at       TIMESTAMPTZ,
  receptionne_at TIMESTAMPTZ,
  clos_at        TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- On n'achète pas son propre livre.
  CONSTRAINT commande_pas_soi_meme CHECK (acheteur_id <> vendeur_id)
);

CREATE INDEX IF NOT EXISTS idx_cmd_occasion_acheteur ON commandes_occasion(acheteur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmd_occasion_vendeur  ON commandes_occasion(vendeur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmd_occasion_statut   ON commandes_occasion(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmd_occasion_paiement ON commandes_occasion(paiement_id);

ALTER TABLE commandes_occasion ENABLE ROW LEVEL SECURITY;

-- Acheteur et vendeur voient leur commande ; personne d'autre.
DROP POLICY IF EXISTS "cmd_occasion_lecture_parties" ON commandes_occasion;
CREATE POLICY "cmd_occasion_lecture_parties" ON commandes_occasion
  FOR SELECT USING (auth.uid() = acheteur_id OR auth.uid() = vendeur_id);

-- Aucune écriture directe client : tout passe par les RPC SECURITY DEFINER
-- (les transitions déplacent de l'argent, cf. ERROR_LOG 2026-06-23).

CREATE OR REPLACE FUNCTION toucher_cmd_occasion_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cmd_occasion_updated_at ON commandes_occasion;
CREATE TRIGGER trg_cmd_occasion_updated_at
  BEFORE UPDATE ON commandes_occasion
  FOR EACH ROW EXECUTE FUNCTION toucher_cmd_occasion_updated_at();

-- ============================================================
-- Évaluations vendeur (confiance) — visibles publiquement
-- ============================================================

CREATE TABLE IF NOT EXISTS vendeur_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL UNIQUE REFERENCES commandes_occasion(id) ON DELETE CASCADE,
  vendeur_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acheteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note INT NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT CHECK (commentaire IS NULL OR char_length(commentaire) <= 500),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendeur_eval_vendeur ON vendeur_evaluations(vendeur_id);

ALTER TABLE vendeur_evaluations ENABLE ROW LEVEL SECURITY;

-- La réputation d'un vendeur est publique (elle sert la confiance).
DROP POLICY IF EXISTS "vendeur_eval_lecture_publique" ON vendeur_evaluations;
CREATE POLICY "vendeur_eval_lecture_publique" ON vendeur_evaluations
  FOR SELECT USING (true);

-- ============================================================
-- RPC creer_commande_occasion — l'acheteur réserve une annonce
-- ============================================================

CREATE OR REPLACE FUNCTION creer_commande_occasion(
  p_offre_id UUID,
  p_mode_remise TEXT DEFAULT 'main_propre',
  p_remise_infos JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offre    livre_offres%ROWTYPE;
  v_user     UUID := auth.uid();
  v_commission INT;
  v_montant  INT;
  v_cmd_id   UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour commander.';
  END IF;

  SELECT * INTO v_offre FROM livre_offres WHERE id = p_offre_id FOR UPDATE;

  IF v_offre.id IS NULL THEN
    RAISE EXCEPTION 'Annonce introuvable.';
  END IF;
  IF v_offre.type <> 'occasion' THEN
    RAISE EXCEPTION 'Cette annonce n''est pas une offre d''occasion.';
  END IF;
  IF v_offre.statut <> 'active' THEN
    RAISE EXCEPTION 'Cette annonce n''est plus disponible.';
  END IF;
  IF v_offre.vendeur_id = v_user THEN
    RAISE EXCEPTION 'Vous ne pouvez pas acheter votre propre annonce.';
  END IF;
  IF v_offre.stock IS NOT NULL AND v_offre.stock < 1 THEN
    RAISE EXCEPTION 'Article épuisé.';
  END IF;

  v_montant := round(v_offre.prix)::INT;
  IF v_montant < 100 THEN
    RAISE EXCEPTION 'Prix invalide.';
  END IF;

  -- Commission plateforme 20 % ; le reste au vendeur ; l'auteur ne touche rien.
  -- La plateforme porte les frais Fapshi (D16) : le vendeur reçoit prix - commission.
  v_commission := round(v_montant * 20 / 100.0)::INT;

  INSERT INTO commandes_occasion (
    offre_id, livre_id, acheteur_id, vendeur_id,
    montant_xaf, commission_xaf, montant_vendeur_xaf, devise,
    mode_remise, remise_infos, statut
  ) VALUES (
    v_offre.id, v_offre.livre_id, v_user, v_offre.vendeur_id,
    v_montant, v_commission, v_montant - v_commission, COALESCE(v_offre.devise, 'XAF'),
    COALESCE(p_mode_remise, 'main_propre'), COALESCE(p_remise_infos, '{}'::jsonb),
    'en_attente_paiement'
  )
  RETURNING id INTO v_cmd_id;

  RETURN v_cmd_id;
END;
$$;

-- ============================================================
-- RPC confirmer_remise — le VENDEUR déclare avoir remis/expédié
-- ============================================================

CREATE OR REPLACE FUNCTION confirmer_remise(p_commande_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_cmd commandes_occasion%ROWTYPE;
BEGIN
  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id FOR UPDATE;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF v_cmd.vendeur_id <> auth.uid() THEN RAISE EXCEPTION 'Seul le vendeur peut confirmer la remise.'; END IF;
  IF v_cmd.statut <> 'paye_sequestre' THEN RAISE EXCEPTION 'La remise n''est possible qu''après paiement.'; END IF;

  UPDATE commandes_occasion SET statut = 'remis', remis_at = now() WHERE id = p_commande_id;
END;
$$;

-- ============================================================
-- RPC confirmer_reception — l'ACHETEUR confirme → libère le vendeur
-- ============================================================

CREATE OR REPLACE FUNCTION confirmer_reception(p_commande_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_cmd commandes_occasion%ROWTYPE;
BEGIN
  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id FOR UPDATE;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF v_cmd.acheteur_id <> auth.uid() THEN RAISE EXCEPTION 'Seul l''acheteur peut confirmer la réception.'; END IF;
  IF v_cmd.statut <> 'remis' THEN RAISE EXCEPTION 'Rien à confirmer pour cette commande.'; END IF;

  -- Réception confirmée → clôture → le vendeur doit être payé (payout externe).
  UPDATE commandes_occasion
     SET statut = 'clos',
         receptionne_at = now(),
         clos_at = now(),
         fonds_liberes = true,
         payout_statut = 'a_verser'
   WHERE id = p_commande_id;
END;
$$;

-- ============================================================
-- RPC ouvrir_litige — acheteur OU vendeur, gèle la commande
-- ============================================================

CREATE OR REPLACE FUNCTION ouvrir_litige(p_commande_id UUID, p_motif TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_cmd commandes_occasion%ROWTYPE;
BEGIN
  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id FOR UPDATE;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF auth.uid() NOT IN (v_cmd.acheteur_id, v_cmd.vendeur_id) THEN
    RAISE EXCEPTION 'Seules les parties peuvent ouvrir un litige.';
  END IF;
  IF v_cmd.statut NOT IN ('paye_sequestre','remis') THEN
    RAISE EXCEPTION 'Aucun litige possible à ce stade.';
  END IF;

  UPDATE commandes_occasion
     SET statut = 'litige', litige_motif = left(COALESCE(p_motif, ''), 500)
   WHERE id = p_commande_id;
END;
$$;

-- ============================================================
-- RPC evaluer_vendeur — l'acheteur note le vendeur après clôture
-- ============================================================

CREATE OR REPLACE FUNCTION evaluer_vendeur(p_commande_id UUID, p_note INT, p_commentaire TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_cmd commandes_occasion%ROWTYPE;
BEGIN
  IF p_note < 1 OR p_note > 5 THEN RAISE EXCEPTION 'Note attendue entre 1 et 5.'; END IF;

  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF v_cmd.acheteur_id <> auth.uid() THEN RAISE EXCEPTION 'Seul l''acheteur peut évaluer.'; END IF;
  IF v_cmd.statut <> 'clos' THEN RAISE EXCEPTION 'Évaluation possible seulement après clôture.'; END IF;

  INSERT INTO vendeur_evaluations (commande_id, vendeur_id, acheteur_id, note, commentaire)
  VALUES (p_commande_id, v_cmd.vendeur_id, v_cmd.acheteur_id, p_note, left(p_commentaire, 500))
  ON CONFLICT (commande_id) DO UPDATE SET note = EXCLUDED.note, commentaire = EXCLUDED.commentaire;
END;
$$;

REVOKE ALL ON FUNCTION creer_commande_occasion(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirmer_remise(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirmer_reception(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION ouvrir_litige(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION evaluer_vendeur(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creer_commande_occasion(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION confirmer_remise(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION confirmer_reception(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ouvrir_litige(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluer_vendeur(UUID, INT, TEXT) TO authenticated;

-- ========== V013 ==========
-- ============================================================
-- V013 — Création d'une annonce d'occasion (P4 #14)
-- Un vendeur d'occasion n'est pas l'auteur du livre : il ne peut donc pas
-- créer la fiche `livres` (bloquée par le RLS auteur). Cette RPC résout le
-- problème côté serveur : elle retrouve la fiche par ISBN ou en crée une
-- minimale (catalogue « import », sans auteur), puis crée l'offre occasion.
--
-- Répartition (D15/D16) : commission 20 %, la plateforme porte les frais
-- Fapshi. Le calcul de ce que touche le vendeur est fait à la commande
-- (creer_commande_occasion, V012) — ici on ne fait que publier l'annonce.
-- ============================================================

CREATE OR REPLACE FUNCTION creer_annonce_occasion(
  p_titre TEXT,
  p_auteur TEXT DEFAULT NULL,
  p_isbn TEXT DEFAULT NULL,
  p_etat TEXT DEFAULT 'bon',
  p_prix NUMERIC DEFAULT 0,
  p_ville TEXT DEFAULT NULL,
  p_mode_remise TEXT DEFAULT 'main_propre',
  p_photos JSONB DEFAULT '[]'::jsonb,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_titre   TEXT := btrim(COALESCE(p_titre, ''));
  v_isbn    TEXT := NULLIF(regexp_replace(COALESCE(p_isbn, ''), '[^0-9Xx]', '', 'g'), '');
  v_prix    INT  := round(COALESCE(p_prix, 0))::INT;
  v_livre_id UUID;
  v_offre_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour vendre.';
  END IF;
  IF char_length(v_titre) < 2 THEN
    RAISE EXCEPTION 'Le titre du livre est requis.';
  END IF;
  IF v_prix < 100 THEN
    RAISE EXCEPTION 'Le prix doit être d''au moins 100 FCFA.';
  END IF;
  IF p_etat NOT IN ('neuf','comme_neuf','bon','correct','use') THEN
    RAISE EXCEPTION 'État du livre invalide.';
  END IF;
  IF p_mode_remise NOT IN ('main_propre','point_relais','livraison') THEN
    RAISE EXCEPTION 'Mode de remise invalide.';
  END IF;

  -- 1. Retrouver la fiche livre par ISBN, sinon en créer une (catalogue import).
  IF v_isbn IS NOT NULL THEN
    SELECT id INTO v_livre_id
    FROM livres
    WHERE isbn13 = v_isbn OR isbn10 = v_isbn
    LIMIT 1;
  END IF;

  IF v_livre_id IS NULL THEN
    INSERT INTO livres (titre, auteur_id, isbn13, type_catalogue, statut, metadata)
    VALUES (
      v_titre,
      NULL,                                   -- occasion : pas d'auteur-membre
      CASE WHEN v_isbn IS NOT NULL AND char_length(v_isbn) = 13 THEN v_isbn END,
      'import',
      'actif',
      jsonb_build_object('auteur_nom', NULLIF(btrim(COALESCE(p_auteur, '')), ''))
    )
    RETURNING id INTO v_livre_id;
  END IF;

  -- 2. Créer l'offre occasion (le vendeur est bien auth.uid()).
  INSERT INTO livre_offres (
    livre_id, vendeur_id, type, statut, prix, devise, stock, conditions
  ) VALUES (
    v_livre_id, v_user, 'occasion', 'active', v_prix, 'XAF', 1,
    jsonb_build_object(
      'etat', p_etat,
      'ville', NULLIF(btrim(COALESCE(p_ville, '')), ''),
      'mode_remise', p_mode_remise,
      'photos', COALESCE(p_photos, '[]'::jsonb),
      'description', NULLIF(btrim(COALESCE(p_description, '')), ''),
      'auteur_nom', NULLIF(btrim(COALESCE(p_auteur, '')), '')
    )
  )
  RETURNING id INTO v_offre_id;

  RETURN v_offre_id;
END;
$$;

REVOKE ALL ON FUNCTION creer_annonce_occasion(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creer_annonce_occasion(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, TEXT) TO authenticated;
