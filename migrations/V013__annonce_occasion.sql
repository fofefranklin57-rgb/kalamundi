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
