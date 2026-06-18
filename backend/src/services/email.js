const nodemailer = require('nodemailer');

// ─────────────────────────────────────────────────────────────────────────────
// Email vía Nodemailer + SMTP Google Workspace (RF-NOT-020)
// Si no hay SMTP configurado, degrada a un log (modo dev / on-premise sin internet).
// ─────────────────────────────────────────────────────────────────────────────

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_NAME = process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || 'NetHub · Penguin Infrastructure';
// APP_URL fallback solo si nadie pasa origin desde el handler. Idealmente el caller
// pasa `appUrl` (derivado del request) para que el link funcione desde cualquier host LAN.
const APP_URL_FALLBACK = process.env.FRONTEND_URL || 'http://localhost';

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function renderTemplate({ title, message, ctaLabel, ctaUrl }) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#1e3a8a;padding:20px 24px">
      <span style="color:#fff;font-size:18px;font-weight:700">NetHub</span>
      <span style="color:#bfdbfe;font-size:13px;display:block">Penguin Infrastructure S.A.</span>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a">${title}</h2>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155">${message}</p>
      ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${ctaLabel || 'Abrir en NetHub'}</a>` : ''}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc">
      <p style="margin:0;font-size:12px;color:#94a3b8">Penguin Infrastructure S.A. · Sede Hernandarias · No respondas a este email.</p>
    </div>
  </div></body></html>`;
}

async function sendEmail({ to, subject, title, message, ctaLabel, ctaUrl, entityPath, appUrl }) {
  const base = appUrl || APP_URL_FALLBACK;
  const url  = ctaUrl || (entityPath ? `${base}${entityPath}` : null);
  const html = renderTemplate({ title: title || subject, message, ctaLabel, ctaUrl: url });

  if (!transporter) {
    console.log(`📧 [email:mock] → ${to} · ${subject}`);
    return { mocked: true };
  }
  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${SMTP_USER}>`,
      to, subject, html,
    });
    return { sent: true };
  } catch (err) {
    console.error('Email falló:', err.message);
    return { error: err.message };
  }
}

module.exports = { sendEmail, renderTemplate };
