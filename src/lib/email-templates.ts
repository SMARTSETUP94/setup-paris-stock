// Templates HTML inline-styled pour les emails transactionnels.
// Style brand Setup Paris : fond #F5F5F4, card blanche radius 16, accent #2F5BFF.
// Pas d'images externes (anti-spam), polices web-safe avec fallback élégant.

const COLORS = {
  bg: "#F5F5F4",
  card: "#FFFFFF",
  text: "#111111",
  muted: "#6B7280",
  accent: "#2F5BFF",
  border: "#E5E7EB",
};

const FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_TITLE = "Georgia, 'Times New Roman', serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Setup Stock</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:${FONT_BODY};color:${COLORS.text};">
  <div style="background:${COLORS.bg};padding:32px 16px;">
    <div style="max-width:540px;margin:0 auto;background:${COLORS.card};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <div style="padding:24px 32px;border-bottom:1px solid ${COLORS.border};">
        <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.muted};font-family:${FONT_BODY};">
          Setup Paris &middot; Stock atelier
        </p>
      </div>
      <div style="padding:32px;">
        ${content}
      </div>
      <div style="padding:20px 32px;background:#FAFAFA;border-top:1px solid ${COLORS.border};">
        <p style="margin:0;font-size:11px;color:${COLORS.muted};font-family:${FONT_BODY};line-height:1.5;">
          Cet email vous a été envoyé par Setup Stock. Pour toute question, répondez à ce message.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="background:${COLORS.accent};border-radius:8px;">
        <a href="${escapeHtml(url)}"
           style="display:inline-block;padding:14px 28px;font-family:${FONT_BODY};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// 1. Invitation admin / utilisateur
// ---------------------------------------------------------------------------

export function inviteAdminTemplate(input: {
  inviterName: string;
  inviteUrl: string;
  roleLabel?: string;
}): { subject: string; html: string; text: string } {
  const inviter = escapeHtml(input.inviterName || "Un administrateur");
  const role = input.roleLabel ? ` en tant que <strong>${escapeHtml(input.roleLabel)}</strong>` : "";

  const subject = `[Setup Stock] ${input.inviterName} vous invite à rejoindre l'app`;

  const html = shell(`
    <h1 style="margin:0 0 16px;font-family:${FONT_TITLE};font-size:26px;font-weight:600;color:${COLORS.text};line-height:1.3;">
      Vous avez été invité
    </h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${COLORS.text};">
      ${inviter} vous invite à rejoindre <strong>Setup Stock</strong>${role}, l'outil de gestion de stock atelier de Setup Paris.
    </p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${COLORS.text};">
      Activez votre compte en cliquant sur le bouton ci-dessous et en choisissant votre mot de passe.
    </p>
    ${ctaButton(input.inviteUrl, "Activer mon compte")}
    <p style="margin:0;font-size:13px;color:${COLORS.muted};line-height:1.6;">
      Ou copiez ce lien dans votre navigateur :<br/>
      <span style="color:${COLORS.accent};word-break:break-all;">${escapeHtml(input.inviteUrl)}</span>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:${COLORS.muted};">
      Cette invitation expire dans 7 jours.
    </p>
  `);

  const text = `${input.inviterName} vous invite à rejoindre Setup Stock.

Activez votre compte : ${input.inviteUrl}

Cette invitation expire dans 7 jours.`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 2. Réinitialisation de mot de passe
// ---------------------------------------------------------------------------

export function passwordResetTemplate(input: {
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "[Setup Stock] Réinitialisation de votre mot de passe";

  const html = shell(`
    <h1 style="margin:0 0 16px;font-family:${FONT_TITLE};font-size:26px;font-weight:600;color:${COLORS.text};line-height:1.3;">
      Réinitialisez votre mot de passe
    </h1>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${COLORS.text};">
      Vous avez demandé à réinitialiser votre mot de passe Setup Stock.
      Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
    </p>
    ${ctaButton(input.resetUrl, "Choisir un nouveau mot de passe")}
    <p style="margin:0;font-size:13px;color:${COLORS.muted};line-height:1.6;">
      Ou copiez ce lien dans votre navigateur :<br/>
      <span style="color:${COLORS.accent};word-break:break-all;">${escapeHtml(input.resetUrl)}</span>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:${COLORS.muted};line-height:1.6;">
      Si vous n'avez pas demandé cette réinitialisation, ignorez ce message — votre mot de passe restera inchangé.
      Ce lien expire dans 2 heures.
    </p>
  `);

  const text = `Réinitialisation de votre mot de passe Setup Stock.

Choisissez un nouveau mot de passe : ${input.resetUrl}

Ce lien expire dans 2 heures. Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// 3. Alerte stock bas (préparé, à brancher plus tard)
// ---------------------------------------------------------------------------

export function stockBasAlertTemplate(input: {
  matieres: Array<{ libelle: string; stock_actuel: number; seuil_alerte: number; unite?: string }>;
  catalogueUrl: string;
}): { subject: string; html: string; text: string } {
  const n = input.matieres.length;
  const subject = `[Setup Stock] ${n} référence${n > 1 ? "s" : ""} sous le seuil d'alerte`;

  const rows = input.matieres
    .map(
      (m) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};">
          ${escapeHtml(m.libelle)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};text-align:right;">
          ${m.stock_actuel}${m.unite ? " " + escapeHtml(m.unite) : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.muted};text-align:right;">
          ${m.seuil_alerte}${m.unite ? " " + escapeHtml(m.unite) : ""}
        </td>
      </tr>`,
    )
    .join("");

  const html = shell(`
    <h1 style="margin:0 0 16px;font-family:${FONT_TITLE};font-size:26px;font-weight:600;color:${COLORS.text};line-height:1.3;">
      Stock bas détecté
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">
      ${n} référence${n > 1 ? "s sont" : " est"} actuellement sous le seuil d'alerte.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#FAFAFA;">
          <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.muted};font-weight:600;">Matière</th>
          <th align="right" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.muted};font-weight:600;">Stock</th>
          <th align="right" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.muted};font-weight:600;">Seuil</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${ctaButton(input.catalogueUrl, "Voir le catalogue")}
  `);

  const text =
    `${n} référence(s) sous le seuil d'alerte :\n\n` +
    input.matieres
      .map((m) => `- ${m.libelle} : ${m.stock_actuel} (seuil ${m.seuil_alerte})`)
      .join("\n") +
    `\n\nVoir le catalogue : ${input.catalogueUrl}`;

  return { subject, html, text };
}
