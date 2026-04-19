CREATE OR REPLACE FUNCTION public.admin_reset_donnees_metier()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _nb_mvt int;
  _nb_lignes int;
  _nb_bdc int;
  _nb_aff int;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Accès refusé : action réservée aux administrateurs';
  END IF;

  DELETE FROM public.mouvements_stock WHERE true;
  GET DIAGNOSTICS _nb_mvt = ROW_COUNT;

  DELETE FROM public.bdc_lignes WHERE true;
  GET DIAGNOSTICS _nb_lignes = ROW_COUNT;

  DELETE FROM public.bons_de_commande WHERE true;
  GET DIAGNOSTICS _nb_bdc = ROW_COUNT;

  DELETE FROM public.affaires WHERE true;
  GET DIAGNOSTICS _nb_aff = ROW_COUNT;

  UPDATE public.panneaux SET cump_ht = NULL WHERE cump_ht IS NOT NULL;

  RETURN jsonb_build_object(
    'mouvements_supprimes', _nb_mvt,
    'lignes_bdc_supprimees', _nb_lignes,
    'bdc_supprimes', _nb_bdc,
    'affaires_supprimees', _nb_aff
  );
END;
$function$;