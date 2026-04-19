// xlsx (~800 kB) et jspdf (~150 kB) chargés à la demande : ces fonctions
// sont déclenchées par un clic utilisateur, le `await import` est invisible.
import { typeMeta } from "@/lib/mouvements";

export type MouvementExport = {
  date: string; // ISO
  type: string;
  matiere_code: string;
  matiere_libelle: string;
  dimensions: string;
  quantite: number;
  unite: string;
  affaire_numero: string;
  affaire_nom: string;
  cump_avant: number | null;
  cump_apres: number | null;
  prix_unitaire_ht: number | null;
  valeur_ligne_ht: number | null;
  operateur: string;
  commentaire: string;
};

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function fmtNum(v: number | null | undefined, d = 2) {
  if (v === null || v === undefined) return "";
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: d,
    minimumFractionDigits: 0,
  }).format(v);
}

function fileSuffix(d1?: string, d2?: string) {
  const s = (d?: string) => (d ? d.slice(0, 10) : "");
  if (d1 && d2) return `${s(d1)}_${s(d2)}`;
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// XLSX (3 feuilles)
// ============================================================
export function exportMouvementsXLSX(
  rows: MouvementExport[],
  opts: { dateDebut?: string; dateFin?: string },
) {
  const wb = XLSX.utils.book_new();

  // Feuille 1 — Mouvements détaillés
  const f1 = rows.map((r) => ({
    Date: fmtDate(r.date),
    Type: typeMeta(r.type).label,
    "Matière (code)": r.matiere_code,
    "Matière (libellé)": r.matiere_libelle,
    Dimensions: r.dimensions,
    Quantité: r.quantite,
    Unité: r.unite,
    "Affaire n°": r.affaire_numero,
    "Affaire nom": r.affaire_nom,
    "CUMP avant (€)": r.cump_avant,
    "CUMP après (€)": r.cump_apres,
    "Prix unitaire HT (€)": r.prix_unitaire_ht,
    "Valeur ligne HT (€)": r.valeur_ligne_ht,
    Opérateur: r.operateur,
    Commentaire: r.commentaire,
  }));
  const ws1 = XLSX.utils.json_to_sheet(f1);
  XLSX.utils.book_append_sheet(wb, ws1, "Mouvements détaillés");

  // Feuille 2 — Synthèse par matière
  const matMap = new Map<
    string,
    {
      code: string;
      libelle: string;
      qteEntree: number;
      valEntree: number;
      qteSortie: number;
      valSortie: number;
      cumpFinal: number | null;
    }
  >();
  for (const r of rows) {
    const key = r.matiere_code || r.matiere_libelle || "—";
    const cur = matMap.get(key) ?? {
      code: r.matiere_code,
      libelle: r.matiere_libelle,
      qteEntree: 0,
      valEntree: 0,
      qteSortie: 0,
      valSortie: 0,
      cumpFinal: r.cump_apres,
    };
    if (r.type === "entree" || r.type === "chute_reintegration") {
      cur.qteEntree += Math.abs(r.quantite);
      cur.valEntree += r.valeur_ligne_ht ?? 0;
    } else if (r.type === "sortie") {
      cur.qteSortie += Math.abs(r.quantite);
      cur.valSortie += r.valeur_ligne_ht ?? 0;
    }
    if (r.cump_apres !== null) cur.cumpFinal = r.cump_apres;
    matMap.set(key, cur);
  }
  const f2 = Array.from(matMap.values()).map((m) => ({
    "Matière (code)": m.code,
    "Matière (libellé)": m.libelle,
    "Qté entrées": m.qteEntree,
    "Valeur entrées HT (€)": Math.round(m.valEntree * 100) / 100,
    "Qté sorties": m.qteSortie,
    "Valeur sorties HT (€)": Math.round(m.valSortie * 100) / 100,
    "Stock net (entrées − sorties)": m.qteEntree - m.qteSortie,
    "CUMP final (€)": m.cumpFinal,
  }));
  const ws2 = XLSX.utils.json_to_sheet(f2);
  XLSX.utils.book_append_sheet(wb, ws2, "Synthèse par matière");

  // Feuille 3 — Synthèse par affaire
  const affMap = new Map<
    string,
    {
      numero: string;
      nom: string;
      qteSortie: number;
      valConsommee: number;
      nbMouvements: number;
    }
  >();
  for (const r of rows) {
    if (!r.affaire_numero) continue;
    const cur = affMap.get(r.affaire_numero) ?? {
      numero: r.affaire_numero,
      nom: r.affaire_nom,
      qteSortie: 0,
      valConsommee: 0,
      nbMouvements: 0,
    };
    cur.nbMouvements += 1;
    if (r.type === "sortie") {
      cur.qteSortie += Math.abs(r.quantite);
      cur.valConsommee += r.valeur_ligne_ht ?? 0;
    }
    affMap.set(r.affaire_numero, cur);
  }
  const f3 = Array.from(affMap.values()).map((a) => ({
    "Affaire n°": a.numero,
    "Affaire nom": a.nom,
    Mouvements: a.nbMouvements,
    "Qté sortie totale": a.qteSortie,
    "Valeur consommée HT au CUMP (€)": Math.round(a.valConsommee * 100) / 100,
  }));
  const ws3 = XLSX.utils.json_to_sheet(f3);
  XLSX.utils.book_append_sheet(wb, ws3, "Synthèse par affaire");

  XLSX.writeFile(wb, `setup-stock-mouvements-${fileSuffix(opts.dateDebut, opts.dateFin)}.xlsx`);
}

// ============================================================
// CSV (séparateur ; + UTF-8 BOM)
// ============================================================
export function exportMouvementsCSV(
  rows: MouvementExport[],
  opts: { dateDebut?: string; dateFin?: string },
) {
  const headers = [
    "Date",
    "Type",
    "Matière code",
    "Matière libellé",
    "Dimensions",
    "Quantité",
    "Unité",
    "Affaire n°",
    "Affaire nom",
    "CUMP avant",
    "CUMP après",
    "Prix unitaire HT",
    "Valeur ligne HT",
    "Opérateur",
    "Commentaire",
  ];
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[";\n\r]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(";")];
  for (const r of rows) {
    lines.push(
      [
        fmtDate(r.date),
        typeMeta(r.type).label,
        r.matiere_code,
        r.matiere_libelle,
        r.dimensions,
        fmtNum(r.quantite, 2),
        r.unite,
        r.affaire_numero,
        r.affaire_nom,
        fmtNum(r.cump_avant, 4),
        fmtNum(r.cump_apres, 4),
        fmtNum(r.prix_unitaire_ht, 4),
        fmtNum(r.valeur_ligne_ht, 2),
        r.operateur,
        r.commentaire,
      ]
        .map(escape)
        .join(";"),
    );
  }
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `setup-stock-mouvements-${fileSuffix(opts.dateDebut, opts.dateFin)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// PDF (jsPDF + autoTable, paysage)
// ============================================================
export function exportMouvementsPDF(
  rows: MouvementExport[],
  opts: { dateDebut?: string; dateFin?: string; filtersSummary?: string },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // En-tête
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SET UP", 14, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Setup Paris · Stock", 14, 20);

  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text("Mouvements de stock", 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  if (opts.filtersSummary) {
    doc.text(opts.filtersSummary, 14, 36);
  }

  autoTable(doc, {
    startY: 42,
    head: [
      [
        "Date",
        "Type",
        "Matière",
        "Dim.",
        "Qté",
        "Affaire",
        "CUMP av.",
        "CUMP ap.",
        "Val. HT",
        "Comm.",
      ],
    ],
    body: rows.map((r) => [
      fmtDate(r.date),
      typeMeta(r.type).label,
      `${r.matiere_code} ${r.matiere_libelle}`.trim().slice(0, 30),
      r.dimensions,
      fmtNum(r.quantite, 2),
      r.affaire_numero ? `${r.affaire_numero} ${r.affaire_nom}`.slice(0, 22) : "—",
      r.cump_avant !== null ? fmtNum(r.cump_avant, 2) + " €" : "",
      r.cump_apres !== null ? fmtNum(r.cump_apres, 2) + " €" : "",
      r.valeur_ligne_ht !== null ? fmtNum(r.valeur_ligne_ht, 2) + " €" : "",
      (r.commentaire ?? "").slice(0, 30),
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [47, 91, 255], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(
        `Export du ${new Date().toLocaleString("fr-FR")} · ${rows.length} mouvement(s)`,
        14,
        pageHeight - 8,
      );
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 20, pageHeight - 8);
    },
  });

  doc.save(`setup-stock-mouvements-${fileSuffix(opts.dateDebut, opts.dateFin)}.pdf`);
}
