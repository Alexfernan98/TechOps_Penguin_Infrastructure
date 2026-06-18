const { google } = require('googleapis');
const prisma = require('../../prisma/client');

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper de Google Drive autenticado con los tokens OAuth del usuario logueado.
// Modelo: cada IT_ADMIN ya tiene permisos de Editor en las carpetas — la app usa
// sus credenciales (no service account) para que los archivos aparezcan subidos
// "por la persona real" y se respete la trazabilidad de Drive.
// ─────────────────────────────────────────────────────────────────────────────

const FOLDER_IDS = {
  DELIVERY:   process.env.DRIVE_FOLDER_DELIVERIES   || null,
  RETURN:     process.env.DRIVE_FOLDER_RETURNS      || null,
  RETIREMENT: process.env.DRIVE_FOLDER_RETIREMENTS  || null,
};

function folderForType(actaType) {
  return FOLDER_IDS[actaType] || null;
}

// Construye un OAuth2 client con los tokens del usuario. Si el access token está
// cerca de caducar, googleapis lo refresca automáticamente con el refresh token.
// Cuando hace refresh, persistimos el nuevo access token en BD.
async function clientForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true, googleTokenExpiry: true },
  });
  if (!user?.googleAccessToken || !user?.googleRefreshToken) {
    const err = new Error('No tenés tokens de Google guardados. Cerrá sesión y volvé a entrar con Google para autorizar acceso a Drive.');
    err.status = 401;
    err.code = 'NO_GOOGLE_TOKENS';
    throw err;
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({
    access_token:  user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date:   user.googleTokenExpiry ? user.googleTokenExpiry.getTime() : null,
  });

  // Persistir nuevos tokens cuando googleapis hace refresh internamente.
  oauth2.on('tokens', async (tokens) => {
    try {
      const data = {};
      if (tokens.access_token)  data.googleAccessToken = tokens.access_token;
      if (tokens.refresh_token) data.googleRefreshToken = tokens.refresh_token;
      if (tokens.expiry_date)   data.googleTokenExpiry  = new Date(tokens.expiry_date);
      if (Object.keys(data).length) {
        await prisma.user.update({ where: { id: userId }, data });
      }
    } catch (e) { console.error('drive: no se pudo persistir tokens refrescados:', e.message); }
  });

  return oauth2;
}

async function driveFor(userId) {
  const auth = await clientForUser(userId);
  return google.drive({ version: 'v3', auth });
}

// Cache de subcarpetas para no llamar a Drive 2 veces por upload. Se vacía solo
// cuando reinicia el process — está bien para una operación poco frecuente.
const SUBFOLDER_CACHE = new Map(); // key: `${parentId}/${name}` → folderId

// Asegura que exista una subcarpeta con `name` dentro de `parentFolderId` y
// devuelve su ID. Si no existe, la crea con la cuenta del usuario logueado.
async function ensureSubfolder(userId, parentFolderId, name) {
  const safe = String(name).trim();
  if (!safe) return parentFolderId; // sin nombre → no anidar
  const cacheKey = `${parentFolderId}/${safe}`;
  if (SUBFOLDER_CACHE.has(cacheKey)) return SUBFOLDER_CACHE.get(cacheKey);

  const drive = await driveFor(userId);
  const q = [
    `'${parentFolderId}' in parents`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${safe.replace(/'/g, "\\'")}'`,
    `trashed = false`,
  ].join(' and ');
  const search = await drive.files.list({ q, fields: 'files(id, name)', pageSize: 5 });

  let folderId = search.data.files?.[0]?.id;
  if (!folderId) {
    const created = await drive.files.create({
      requestBody: {
        name: safe,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    });
    folderId = created.data.id;
  }
  SUBFOLDER_CACHE.set(cacheKey, folderId);
  return folderId;
}

// Backward-compat: el alias `ensureYearSubfolder` queda mientras hay callers
// que solo necesitan el nivel YYYY (ej. devolución/baja cuando no hay categoría).
async function ensureYearSubfolder(userId, parentFolderId, year) {
  return ensureSubfolder(userId, parentFolderId, String(year));
}

// Lista archivos PDF (o cualquier mime) en una carpeta específica.
// Devuelve metadata mínima útil para mostrar en la app.
async function listFolder(userId, folderId, { pageSize = 100 } = {}) {
  if (!folderId) return [];
  const drive = await driveFor(userId);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, createdTime, webViewLink, iconLink, size, owners(displayName,emailAddress))',
    orderBy: 'modifiedTime desc',
    pageSize,
  });
  return res.data.files || [];
}

// Sube un buffer/stream a la subcarpeta `año/categoría` dentro de `parentFolderId`.
// La estructura final es:
//   {tipo}/{YYYY}/{Categoría}/{archivo.pdf}
// Si no se pasa categoría, queda solo en {tipo}/{YYYY}/. Útil para casos donde
// el activo no tiene categoría resuelta (no debería pasar, pero el código es
// resiliente).
//
// Devuelve metadata del archivo + un webViewLink "autenticado" que fuerza a
// Google a usar la cuenta correcta (evita el problema de "cuenta primaria del
// browser" cuando el usuario tiene varias cuentas Google).
async function uploadToFolder(userId, folderId, { name, mimeType, stream, year, categoryName, userEmail }) {
  if (!folderId) {
    const err = new Error('Falta configurar el ID de la carpeta destino en Drive');
    err.status = 500;
    err.code = 'NO_FOLDER_ID';
    throw err;
  }
  const yyyy = year || new Date().getFullYear();
  const yearFolderId = await ensureSubfolder(userId, folderId, String(yyyy));
  const targetFolderId = categoryName
    ? await ensureSubfolder(userId, yearFolderId, categoryName)
    : yearFolderId;

  const drive = await driveFor(userId);
  const res = await drive.files.create({
    requestBody: { name, parents: [targetFolderId], mimeType },
    media: { mimeType, body: stream },
    fields: 'id, name, mimeType, webViewLink, modifiedTime, size',
  });

  // Compartir el archivo con todo el dominio del usuario para que otros
  // IT_ADMIN puedan abrirlo. Sin esto, drive.file crea archivos privados al
  // creador (no hereda permisos de la carpeta padre fuera de Shared Drives).
  // role=writer porque varios IT_ADMIN podrían subir/sobre-escribir.
  // Compartir 2 niveles:
  //   1. Dominio penguin.digital con role=writer (para que otros IT_ADMIN
  //      puedan sobreescribir). Puede fallar si Workspace restringe sharing.
  //   2. anyoneWithLink con role=reader (fallback siempre disponible — el ID
  //      del archivo es opaco y solo se distribuye dentro de NetHub).
  // Sin esto, drive.file crea archivos privados al creador.
  try {
    const domain = (userEmail || '').split('@')[1];
    if (domain) {
      await drive.permissions.create({
        fileId: res.data.id,
        sendNotificationEmail: false,
        requestBody: { type: 'domain', role: 'writer', domain },
      });
    }
  } catch (e) {
    console.warn('drive: no se pudo compartir con el dominio:', e.message);
  }
  try {
    await drive.permissions.create({
      fileId: res.data.id,
      sendNotificationEmail: false,
      requestBody: { type: 'anyone', role: 'reader' },
    });
  } catch (e) {
    console.warn('drive: no se pudo compartir como anyoneWithLink:', e.message);
  }

  let webViewLink = res.data.webViewLink || null;
  if (webViewLink && userEmail) {
    const sep = webViewLink.includes('?') ? '&' : '?';
    webViewLink = `${webViewLink}${sep}authuser=${encodeURIComponent(userEmail)}`;
  }
  return { ...res.data, webViewLink, yearFolderId, targetFolderId };
}

module.exports = { FOLDER_IDS, folderForType, listFolder, uploadToFolder, ensureSubfolder, ensureYearSubfolder };
