-- ============================================================
-- V004 — RPC supprimer_oeuvre (SECURITY DEFINER)
-- Bypass RLS côté client, vérification auteur en interne
-- ============================================================

CREATE OR REPLACE FUNCTION supprimer_oeuvre(p_oeuvre_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auteur_id UUID;
BEGIN
  SELECT auteur_id INTO v_auteur_id
  FROM oeuvres
  WHERE id = p_oeuvre_id;

  IF v_auteur_id IS NULL THEN
    RAISE EXCEPTION 'Oeuvre introuvable.';
  END IF;

  IF v_auteur_id != auth.uid() THEN
    RAISE EXCEPTION 'Non autorise : vous n''etes pas l''auteur de cette oeuvre.';
  END IF;

  UPDATE oeuvres SET visible = false WHERE id = p_oeuvre_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION supprimer_oeuvre(UUID) TO authenticated;
