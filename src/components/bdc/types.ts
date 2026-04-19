export type BdcDetail = {
  id: string;
  numero_bdc: string | null;
  date_bdc: string | null;
  statut: string;
  montant_ht_total: number | null;
  fichier_pdf_url: string | null;
  affaire_id: string | null;
  fournisseur_id: string;
  validated_at: string | null;
  extraction_brute_json: unknown;
};

export type LigneRow = {
  id: string;
  bdc_id: string;
  panneau_id: string | null;
  matiere_libelle_brut: string | null;
  dimensions_brut: string | null;
  quantite: number;
  prix_unitaire_ht: number;
  ligne_validee: boolean;
};

export type PanneauOption = {
  id: string;
  matiere_code: string | null;
  matiere_libelle: string | null;
  longueur_mm: number | null;
  largeur_mm: number | null;
  cump_ht: number | null;
};

export type Fournisseur = { id: string; nom: string };
export type Affaire = { id: string; code_chantier: string; nom: string };
