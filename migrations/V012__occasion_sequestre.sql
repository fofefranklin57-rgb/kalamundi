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

  -- Commission plateforme 15 % ; le reste au vendeur ; l'auteur ne touche rien.
  v_commission := round(v_montant * 15 / 100.0)::INT;

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
