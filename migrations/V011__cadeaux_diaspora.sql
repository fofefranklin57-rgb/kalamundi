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
