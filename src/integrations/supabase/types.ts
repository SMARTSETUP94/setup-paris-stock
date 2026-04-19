export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      affaire_acces: {
        Row: {
          affaire_id: string
          created_at: string
          email_invite: string
          expire_le: string
          id: string
          permissions: Database["public"]["Enums"]["permission_acces"]
          tiers_profile_id: string | null
          token: string
        }
        Insert: {
          affaire_id: string
          created_at?: string
          email_invite: string
          expire_le: string
          id?: string
          permissions?: Database["public"]["Enums"]["permission_acces"]
          tiers_profile_id?: string | null
          token: string
        }
        Update: {
          affaire_id?: string
          created_at?: string
          email_invite?: string
          expire_le?: string
          id?: string
          permissions?: Database["public"]["Enums"]["permission_acces"]
          tiers_profile_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "affaire_acces_affaire_id_fkey"
            columns: ["affaire_id"]
            isOneToOne: false
            referencedRelation: "affaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affaire_acces_tiers_profile_id_fkey"
            columns: ["tiers_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affaires: {
        Row: {
          adresse: string | null
          budget_panneaux_ht: number | null
          charge_affaires_id: string | null
          charge_affaires_libre: string | null
          client: string
          code_chantier: string
          code_interne: string | null
          created_at: string
          date_debut: string | null
          date_fin_prevue: string | null
          id: string
          nom: string
          notes: string | null
          numero: string | null
          responsable_id: string | null
          statut: Database["public"]["Enums"]["statut_affaire"]
        }
        Insert: {
          adresse?: string | null
          budget_panneaux_ht?: number | null
          charge_affaires_id?: string | null
          charge_affaires_libre?: string | null
          client: string
          code_chantier: string
          code_interne?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin_prevue?: string | null
          id?: string
          nom: string
          notes?: string | null
          numero?: string | null
          responsable_id?: string | null
          statut?: Database["public"]["Enums"]["statut_affaire"]
        }
        Update: {
          adresse?: string | null
          budget_panneaux_ht?: number | null
          charge_affaires_id?: string | null
          charge_affaires_libre?: string | null
          client?: string
          code_chantier?: string
          code_interne?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin_prevue?: string | null
          id?: string
          nom?: string
          notes?: string | null
          numero?: string | null
          responsable_id?: string | null
          statut?: Database["public"]["Enums"]["statut_affaire"]
        }
        Relationships: [
          {
            foreignKeyName: "affaires_charge_affaires_id_fkey"
            columns: ["charge_affaires_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affaires_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bdc_lignes: {
        Row: {
          bdc_id: string
          dimensions_brut: string | null
          id: string
          ligne_validee: boolean
          matiere_libelle_brut: string | null
          panneau_id: string | null
          prix_unitaire_ht: number
          quantite: number
        }
        Insert: {
          bdc_id: string
          dimensions_brut?: string | null
          id?: string
          ligne_validee?: boolean
          matiere_libelle_brut?: string | null
          panneau_id?: string | null
          prix_unitaire_ht?: number
          quantite?: number
        }
        Update: {
          bdc_id?: string
          dimensions_brut?: string | null
          id?: string
          ligne_validee?: boolean
          matiere_libelle_brut?: string | null
          panneau_id?: string | null
          prix_unitaire_ht?: number
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "bdc_lignes_bdc_id_fkey"
            columns: ["bdc_id"]
            isOneToOne: false
            referencedRelation: "bons_de_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bdc_lignes_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "catalogue_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bdc_lignes_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "consommation_par_affaire"
            referencedColumns: ["panneau_id"]
          },
          {
            foreignKeyName: "bdc_lignes_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "cump_par_panneau"
            referencedColumns: ["panneau_id"]
          },
          {
            foreignKeyName: "bdc_lignes_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "panneaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bdc_lignes_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "stock_actuel"
            referencedColumns: ["panneau_id"]
          },
        ]
      }
      bons_de_commande: {
        Row: {
          affaire_id: string | null
          created_at: string
          cree_par: string | null
          date_bdc: string | null
          extraction_brute_json: Json | null
          fichier_pdf_url: string | null
          fournisseur_id: string
          id: string
          montant_ht_total: number | null
          numero_bdc: string | null
          statut: Database["public"]["Enums"]["statut_bdc"]
          validated_at: string | null
        }
        Insert: {
          affaire_id?: string | null
          created_at?: string
          cree_par?: string | null
          date_bdc?: string | null
          extraction_brute_json?: Json | null
          fichier_pdf_url?: string | null
          fournisseur_id: string
          id?: string
          montant_ht_total?: number | null
          numero_bdc?: string | null
          statut?: Database["public"]["Enums"]["statut_bdc"]
          validated_at?: string | null
        }
        Update: {
          affaire_id?: string | null
          created_at?: string
          cree_par?: string | null
          date_bdc?: string | null
          extraction_brute_json?: Json | null
          fichier_pdf_url?: string | null
          fournisseur_id?: string
          id?: string
          montant_ht_total?: number | null
          numero_bdc?: string | null
          statut?: Database["public"]["Enums"]["statut_bdc"]
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bons_de_commande_affaire_id_fkey"
            columns: ["affaire_id"]
            isOneToOne: false
            referencedRelation: "affaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_de_commande_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_de_commande_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          adresse: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          notes: string | null
          siret: string | null
          telephone: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          notes?: string | null
          siret?: string | null
          telephone?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          notes?: string | null
          siret?: string | null
          telephone?: string | null
        }
        Relationships: []
      }
      matieres: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          densite_kg_m3: number | null
          famille: Database["public"]["Enums"]["famille_matiere"]
          id: string
          libelle: string
          photo_url: string | null
          seuil_alerte: number
          typologie_id: string
          unite_stock: Database["public"]["Enums"]["unite_stock"]
          variante: string | null
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          densite_kg_m3?: number | null
          famille?: Database["public"]["Enums"]["famille_matiere"]
          id?: string
          libelle: string
          photo_url?: string | null
          seuil_alerte?: number
          typologie_id: string
          unite_stock?: Database["public"]["Enums"]["unite_stock"]
          variante?: string | null
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          densite_kg_m3?: number | null
          famille?: Database["public"]["Enums"]["famille_matiere"]
          id?: string
          libelle?: string
          photo_url?: string | null
          seuil_alerte?: number
          typologie_id?: string
          unite_stock?: Database["public"]["Enums"]["unite_stock"]
          variante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matieres_typologie_id_fkey"
            columns: ["typologie_id"]
            isOneToOne: false
            referencedRelation: "typologies"
            referencedColumns: ["id"]
          },
        ]
      }
      mouvements_stock: {
        Row: {
          affaire_id: string | null
          bdc_id: string | null
          commentaire: string | null
          created_at: string
          cump_apres: number | null
          cump_avant: number | null
          effectue_par: string | null
          id: string
          panneau_id: string
          photo_url: string | null
          prix_unitaire_ht: number | null
          quantite: number
          type: Database["public"]["Enums"]["type_mouvement"]
          valeur_ligne_ht: number | null
        }
        Insert: {
          affaire_id?: string | null
          bdc_id?: string | null
          commentaire?: string | null
          created_at?: string
          cump_apres?: number | null
          cump_avant?: number | null
          effectue_par?: string | null
          id?: string
          panneau_id: string
          photo_url?: string | null
          prix_unitaire_ht?: number | null
          quantite: number
          type: Database["public"]["Enums"]["type_mouvement"]
          valeur_ligne_ht?: number | null
        }
        Update: {
          affaire_id?: string | null
          bdc_id?: string | null
          commentaire?: string | null
          created_at?: string
          cump_apres?: number | null
          cump_avant?: number | null
          effectue_par?: string | null
          id?: string
          panneau_id?: string
          photo_url?: string | null
          prix_unitaire_ht?: number | null
          quantite?: number
          type?: Database["public"]["Enums"]["type_mouvement"]
          valeur_ligne_ht?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mouvements_stock_affaire_id_fkey"
            columns: ["affaire_id"]
            isOneToOne: false
            referencedRelation: "affaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_stock_bdc_id_fkey"
            columns: ["bdc_id"]
            isOneToOne: false
            referencedRelation: "bons_de_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_stock_effectue_par_fkey"
            columns: ["effectue_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_stock_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "catalogue_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_stock_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "consommation_par_affaire"
            referencedColumns: ["panneau_id"]
          },
          {
            foreignKeyName: "mouvements_stock_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "cump_par_panneau"
            referencedColumns: ["panneau_id"]
          },
          {
            foreignKeyName: "mouvements_stock_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "panneaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_stock_panneau_id_fkey"
            columns: ["panneau_id"]
            isOneToOne: false
            referencedRelation: "stock_actuel"
            referencedColumns: ["panneau_id"]
          },
        ]
      }
      panneaux: {
        Row: {
          actif: boolean
          auto_masque_si_zero: boolean
          created_at: string
          cump_ht: number | null
          epaisseur_mm: number
          id: string
          largeur_mm: number
          longueur_mm: number
          matiere_id: string
          prix_achat_ht: number | null
          reference_fournisseur: string | null
          surface_m2: number | null
        }
        Insert: {
          actif?: boolean
          auto_masque_si_zero?: boolean
          created_at?: string
          cump_ht?: number | null
          epaisseur_mm: number
          id?: string
          largeur_mm: number
          longueur_mm: number
          matiere_id: string
          prix_achat_ht?: number | null
          reference_fournisseur?: string | null
          surface_m2?: number | null
        }
        Update: {
          actif?: boolean
          auto_masque_si_zero?: boolean
          created_at?: string
          cump_ht?: number | null
          epaisseur_mm?: number
          id?: string
          largeur_mm?: number
          longueur_mm?: number
          matiere_id?: string
          prix_achat_ht?: number | null
          reference_fournisseur?: string | null
          surface_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "panneaux_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          actif: boolean
          created_at: string
          email: string
          id: string
          nom_complet: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email: string
          id: string
          nom_complet?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string
          id?: string
          nom_complet?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      typologies: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          description: string | null
          famille: Database["public"]["Enums"]["famille_matiere"]
          id: string
          nom: string
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          description?: string | null
          famille: Database["public"]["Enums"]["famille_matiere"]
          id?: string
          nom: string
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          description?: string | null
          famille?: Database["public"]["Enums"]["famille_matiere"]
          id?: string
          nom?: string
        }
        Relationships: []
      }
    }
    Views: {
      catalogue_visible: {
        Row: {
          actif: boolean | null
          auto_masque_si_zero: boolean | null
          created_at: string | null
          cump_ht: number | null
          epaisseur_mm: number | null
          famille: Database["public"]["Enums"]["famille_matiere"] | null
          id: string | null
          largeur_mm: number | null
          longueur_mm: number | null
          matiere_code: string | null
          matiere_id: string | null
          matiere_libelle: string | null
          prix_achat_ht: number | null
          reference_fournisseur: string | null
          seuil_alerte: number | null
          stock_actuel: number | null
          surface_m2: number | null
          unite_stock: Database["public"]["Enums"]["unite_stock"] | null
          valeur_stock_ht: number | null
        }
        Relationships: [
          {
            foreignKeyName: "panneaux_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      consommation_par_affaire: {
        Row: {
          affaire_id: string | null
          matiere_id: string | null
          panneau_id: string | null
          qte_entree: number | null
          qte_sortie: number | null
          reliquat: number | null
          surface_m2_totale: number | null
          valeur_consommee_ht: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mouvements_stock_affaire_id_fkey"
            columns: ["affaire_id"]
            isOneToOne: false
            referencedRelation: "affaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panneaux_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      cump_par_panneau: {
        Row: {
          cump_ht: number | null
          dernieres_entrees: Json | null
          panneau_id: string | null
          stock_actuel: number | null
        }
        Relationships: []
      }
      stock_actuel: {
        Row: {
          panneau_id: string | null
          quantite_actuelle: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      affaires_autorisees_tiers: {
        Args: { _user_id: string }
        Returns: string[]
      }
      ensure_current_profile: {
        Args: never
        Returns: {
          actif: boolean
          created_at: string
          email: string
          id: string
          nom_complet: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      match_fournisseur_par_nom: {
        Args: { _nom: string; _seuil?: number }
        Returns: {
          fournisseur_id: string
          nom: string
          similarity: number
        }[]
      }
      match_panneaux_par_description: {
        Args: { _description: string; _limit?: number; _seuil?: number }
        Returns: {
          largeur_mm: number
          longueur_mm: number
          matiere_id: string
          matiere_libelle: string
          panneau_id: string
          similarity: number
        }[]
      }
      tiers_a_acces_affaire: {
        Args: { _affaire_id: string; _user_id: string }
        Returns: boolean
      }
      tiers_peut_ecrire_mvt: {
        Args: { _affaire_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "tiers"
      famille_matiere:
        | "bois"
        | "pvc"
        | "carton"
        | "dibond_tole"
        | "pmma"
        | "mousse"
        | "autre"
      permission_acces: "lecture" | "sortie" | "entree_sortie"
      statut_affaire: "devis" | "en_cours" | "termine" | "archive"
      statut_bdc:
        | "en_attente_ocr"
        | "ocr_termine"
        | "valide"
        | "recu"
        | "annule"
      type_mouvement: "entree" | "sortie" | "correction" | "chute_reintegration"
      unite_stock:
        | "panneau"
        | "m2"
        | "ml"
        | "piece"
        | "kg"
        | "m3"
        | "boite"
        | "cartouche"
        | "autre"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "tiers"],
      famille_matiere: [
        "bois",
        "pvc",
        "carton",
        "dibond_tole",
        "pmma",
        "mousse",
        "autre",
      ],
      permission_acces: ["lecture", "sortie", "entree_sortie"],
      statut_affaire: ["devis", "en_cours", "termine", "archive"],
      statut_bdc: ["en_attente_ocr", "ocr_termine", "valide", "recu", "annule"],
      type_mouvement: ["entree", "sortie", "correction", "chute_reintegration"],
      unite_stock: [
        "panneau",
        "m2",
        "ml",
        "piece",
        "kg",
        "m3",
        "boite",
        "cartouche",
        "autre",
      ],
    },
  },
} as const
