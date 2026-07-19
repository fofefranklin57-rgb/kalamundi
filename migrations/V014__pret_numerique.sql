-- ============================================================
-- V014 — Emprunter : prêt numérique à accès temporel + file d'attente (P4 #15)
-- Objectif : reproduire le prêt de bibliothèque sur le fonds maison
-- (D6 : limité aux livres que Kalamundi a le droit de prêter).
--
-- Le "fonds maison" = les livre_offres.type='pret_numerique' créées côté
-- admin/auteur : `stock` = nombre d'exemplaires prêtables en parallèle,
-- `duree_acces_jours` = durée du prêt (défaut 14 jours si non précisé).
--
-- L'accès en lecture réutilise la table acces_premium existante (même
-- porte que l'achat, cf. api.verifierAccesPremium) : un prêt actif y
-- ajoute une ligne avec expire_le renseigné et emprunt_id pour la tracer.
-- Un achat (paiement_id renseigné) n'expire jamais et n'est jamais touché
-- par l'expiration des prêts (cf. expirer_emprunts ci-dessous).
-- ============================================================

ALTER TABLE acces_premium
  ADD COLUMN IF NOT EXISTS expire_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emprunt_id UUID;

CREATE TABLE IF NOT EXISTS emprunts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offre_id UUID NOT NULL REFERENCES livre_offres(id) ON DELETE RESTRICT,
  livre_id UUID NOT NULL REFERENCES livres(id) ON DELETE RESTRICT,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE SET NULL,
  emprunteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'actif'
    CHECK (statut IN ('actif','rendu','expire')),
  emprunte_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_le TIMESTAMPTZ NOT NULL,
  rendu_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'acces_premium_emprunt_fk'
  ) THEN
    ALTER TABLE acces_premium
      ADD CONSTRAINT acces_premium_emprunt_fk
      FOREIGN KEY (emprunt_id) REFERENCES emprunts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Un seul prêt actif par (offre, emprunteur) — pas d'emprunts en double.
CREATE UNIQUE INDEX IF NOT EXISTS idx_emprunts_actif_unique
  ON emprunts(offre_id, emprunteur_id) WHERE statut = 'actif';

CREATE INDEX IF NOT EXISTS idx_emprunts_emprunteur ON emprunts(emprunteur_id, statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emprunts_offre_actif ON emprunts(offre_id) WHERE statut = 'actif';
CREATE INDEX IF NOT EXISTS idx_emprunts_expiration ON emprunts(expire_le) WHERE statut = 'actif';

ALTER TABLE emprunts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emprunts_lecture_proprietaire" ON emprunts;
CREATE POLICY "emprunts_lecture_proprietaire" ON emprunts
  FOR SELECT USING (auth.uid() = emprunteur_id);

-- Aucune écriture directe : tout passe par les RPC SECURITY DEFINER
-- (mêmes précautions que l'occasion, cf. ERROR_LOG 2026-06-23).

CREATE TABLE IF NOT EXISTS emprunts_file_attente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offre_id UUID NOT NULL REFERENCES livre_offres(id) ON DELETE CASCADE,
  livre_id UUID NOT NULL REFERENCES livres(id) ON DELETE CASCADE,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE SET NULL,
  utilisateur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'attente'
    CHECK (statut IN ('attente','servie','abandonnee')),
  created_at TIMESTAMPTZ DEFAULT now(),
  servie_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_attente_unique
  ON emprunts_file_attente(offre_id, utilisateur_id) WHERE statut = 'attente';

CREATE INDEX IF NOT EXISTS idx_file_attente_offre ON emprunts_file_attente(offre_id, created_at) WHERE statut = 'attente';

ALTER TABLE emprunts_file_attente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_attente_lecture_proprietaire" ON emprunts_file_attente;
CREATE POLICY "file_attente_lecture_proprietaire" ON emprunts_file_attente
  FOR SELECT USING (auth.uid() = utilisateur_id);

-- ============================================================
-- Helper interne — promeut le premier de la file quand une place se libère
-- ============================================================

CREATE OR REPLACE FUNCTION promouvoir_file_attente(p_offre_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offre livre_offres%ROWTYPE;
  v_file  emprunts_file_attente%ROWTYPE;
  v_duree INTEGER;
  v_nouvel_emprunt_id UUID;
BEGIN
  SELECT * INTO v_offre FROM livre_offres WHERE id = p_offre_id FOR UPDATE;
  IF v_offre.id IS NULL THEN RETURN; END IF;

  -- Place déjà prise entre-temps ?
  IF v_offre.stock IS NOT NULL AND
     (SELECT COUNT(*) FROM emprunts WHERE offre_id = p_offre_id AND statut = 'actif') >= v_offre.stock THEN
    RETURN;
  END IF;

  SELECT * INTO v_file FROM emprunts_file_attente
    WHERE offre_id = p_offre_id AND statut = 'attente'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  IF v_file.id IS NULL THEN RETURN; END IF;

  v_duree := COALESCE(v_offre.duree_acces_jours, 14);

  INSERT INTO emprunts (offre_id, livre_id, oeuvre_id, emprunteur_id, expire_le)
  VALUES (v_offre.id, v_offre.livre_id, v_file.oeuvre_id, v_file.utilisateur_id, now() + (v_duree || ' days')::interval)
  ON CONFLICT (offre_id, emprunteur_id) WHERE statut = 'actif' DO NOTHING
  RETURNING id INTO v_nouvel_emprunt_id;

  IF v_nouvel_emprunt_id IS NOT NULL THEN
    UPDATE acces_premium
      SET expire_le = now() + (v_duree || ' days')::interval, emprunt_id = v_nouvel_emprunt_id
      WHERE user_id = v_file.utilisateur_id AND oeuvre_id = v_file.oeuvre_id;
    IF NOT FOUND THEN
      INSERT INTO acces_premium (user_id, oeuvre_id, expire_le, emprunt_id)
      VALUES (v_file.utilisateur_id, v_file.oeuvre_id, now() + (v_duree || ' days')::interval, v_nouvel_emprunt_id);
    END IF;

    UPDATE emprunts_file_attente SET statut = 'servie', servie_at = now()
      WHERE offre_id = p_offre_id AND utilisateur_id = v_file.utilisateur_id AND statut = 'attente';
  END IF;
END;
$$;

-- ============================================================
-- RPC emprunter_livre — l'utilisateur emprunte un exemplaire du fonds maison
-- ============================================================

CREATE OR REPLACE FUNCTION emprunter_livre(p_offre_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offre livre_offres%ROWTYPE;
  v_user  UUID := auth.uid();
  v_duree INTEGER;
  v_emprunt_id UUID;
  v_deja_acces BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour emprunter.';
  END IF;

  SELECT * INTO v_offre FROM livre_offres WHERE id = p_offre_id FOR UPDATE;
  IF v_offre.id IS NULL THEN
    RAISE EXCEPTION 'Offre de prêt introuvable.';
  END IF;
  IF v_offre.type <> 'pret_numerique' THEN
    RAISE EXCEPTION 'Cette offre n''est pas un prêt numérique.';
  END IF;
  IF v_offre.statut <> 'active' THEN
    RAISE EXCEPTION 'Ce prêt n''est plus disponible.';
  END IF;
  IF v_offre.source_oeuvre_id IS NULL THEN
    RAISE EXCEPTION 'Ce livre n''a pas encore d''édition lisible.';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM acces_premium
    WHERE user_id = v_user AND oeuvre_id = v_offre.source_oeuvre_id
      AND (expire_le IS NULL OR expire_le > now())
  ) INTO v_deja_acces;
  IF v_deja_acces THEN
    RAISE EXCEPTION 'Vous avez déjà accès à ce livre.';
  END IF;

  IF v_offre.stock IS NOT NULL AND
     (SELECT COUNT(*) FROM emprunts WHERE offre_id = p_offre_id AND statut = 'actif') >= v_offre.stock THEN
    RAISE EXCEPTION 'file_attente' USING ERRCODE = 'P0001';
  END IF;

  v_duree := COALESCE(v_offre.duree_acces_jours, 14);

  INSERT INTO emprunts (offre_id, livre_id, oeuvre_id, emprunteur_id, expire_le)
  VALUES (v_offre.id, v_offre.livre_id, v_offre.source_oeuvre_id, v_user, now() + (v_duree || ' days')::interval)
  RETURNING id INTO v_emprunt_id;

  INSERT INTO acces_premium (user_id, oeuvre_id, expire_le, emprunt_id)
  VALUES (v_user, v_offre.source_oeuvre_id, now() + (v_duree || ' days')::interval, v_emprunt_id)
  ON CONFLICT (user_id, oeuvre_id) DO UPDATE
    SET expire_le = EXCLUDED.expire_le, emprunt_id = EXCLUDED.emprunt_id;

  -- Si l'utilisateur patientait dans la file, il en sort.
  UPDATE emprunts_file_attente SET statut = 'servie', servie_at = now()
    WHERE offre_id = p_offre_id AND utilisateur_id = v_user AND statut = 'attente';

  RETURN v_emprunt_id;
END;
$$;

-- ============================================================
-- RPC rendre_livre — retour anticipé, libère la place pour la file
-- ============================================================

CREATE OR REPLACE FUNCTION rendre_livre(p_emprunt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_emprunt emprunts%ROWTYPE;
BEGIN
  SELECT * INTO v_emprunt FROM emprunts WHERE id = p_emprunt_id FOR UPDATE;
  IF v_emprunt.id IS NULL THEN RAISE EXCEPTION 'Emprunt introuvable.'; END IF;
  IF v_emprunt.emprunteur_id <> auth.uid() THEN RAISE EXCEPTION 'Seul l''emprunteur peut rendre ce livre.'; END IF;
  IF v_emprunt.statut <> 'actif' THEN RAISE EXCEPTION 'Cet emprunt n''est plus actif.'; END IF;

  UPDATE emprunts SET statut = 'rendu', rendu_le = now() WHERE id = p_emprunt_id;

  DELETE FROM acces_premium WHERE emprunt_id = p_emprunt_id;

  PERFORM promouvoir_file_attente(v_emprunt.offre_id);
END;
$$;

-- ============================================================
-- RPC rejoindre_file_attente / quitter_file_attente
-- ============================================================

CREATE OR REPLACE FUNCTION rejoindre_file_attente(p_offre_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offre livre_offres%ROWTYPE;
  v_user  UUID := auth.uid();
  v_position INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connectez-vous pour rejoindre la file.'; END IF;

  SELECT * INTO v_offre FROM livre_offres WHERE id = p_offre_id;
  IF v_offre.id IS NULL OR v_offre.type <> 'pret_numerique' THEN
    RAISE EXCEPTION 'Offre de prêt introuvable.';
  END IF;

  IF EXISTS(SELECT 1 FROM emprunts WHERE offre_id = p_offre_id AND emprunteur_id = v_user AND statut = 'actif') THEN
    RAISE EXCEPTION 'Vous avez déjà ce livre en cours d''emprunt.';
  END IF;

  INSERT INTO emprunts_file_attente (offre_id, livre_id, oeuvre_id, utilisateur_id)
  VALUES (v_offre.id, v_offre.livre_id, v_offre.source_oeuvre_id, v_user)
  ON CONFLICT (offre_id, utilisateur_id) WHERE statut = 'attente' DO NOTHING;

  SELECT COUNT(*) INTO v_position FROM emprunts_file_attente
    WHERE offre_id = p_offre_id AND statut = 'attente'
      AND created_at <= (SELECT created_at FROM emprunts_file_attente
                          WHERE offre_id = p_offre_id AND utilisateur_id = v_user AND statut = 'attente');

  RETURN v_position;
END;
$$;

CREATE OR REPLACE FUNCTION quitter_file_attente(p_offre_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE emprunts_file_attente SET statut = 'abandonnee'
    WHERE offre_id = p_offre_id AND utilisateur_id = auth.uid() AND statut = 'attente';
END;
$$;

-- ============================================================
-- RPC expirer_emprunts — appelée par le cron horaire (kalamundi-cron)
-- ============================================================

CREATE OR REPLACE FUNCTION expirer_emprunts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emprunt RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_emprunt IN
    SELECT * FROM emprunts WHERE statut = 'actif' AND expire_le <= now()
  LOOP
    UPDATE emprunts SET statut = 'expire' WHERE id = v_emprunt.id;
    DELETE FROM acces_premium WHERE emprunt_id = v_emprunt.id;
    PERFORM promouvoir_file_attente(v_emprunt.offre_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION emprunter_livre(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION rendre_livre(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION rejoindre_file_attente(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION quitter_file_attente(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION promouvoir_file_attente(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION expirer_emprunts() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION emprunter_livre(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rendre_livre(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rejoindre_file_attente(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION quitter_file_attente(UUID) TO authenticated;
-- expirer_emprunts est appelée par le cron via la clé anon (pas d'auth utilisateur,
-- ne dépend d'aucune donnée fournie par l'appelant, n'agit que sur les emprunts
-- déjà expirés en base) — cf. kalamundi-cron/index.js.
GRANT EXECUTE ON FUNCTION expirer_emprunts() TO anon, authenticated;
