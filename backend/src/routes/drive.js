const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { folderForType, listFolder, FOLDER_IDS } = require('../services/drive');

// ─────────────────────────────────────────────────────────────────────────────
// Drive proxy — listar archivos en carpetas configuradas.
// Cada IT_ADMIN ve las cosas con su propia cuenta Google (tiene que tener Editor
// en las carpetas — eso lo administra Drive directamente).
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/drive/actas?type=DELIVERY|RETURN|RETIREMENT
router.get('/actas', authenticate, async (req, res, next) => {
  try {
    const type = (req.query.type || '').toUpperCase();
    const folderId = folderForType(type);
    if (!folderId) {
      return res.status(400).json({ error: `type debe ser DELIVERY, RETURN o RETIREMENT (recibido: ${req.query.type || 'vacío'})` });
    }
    const files = await listFolder(req.user.id, folderId);
    res.json({ files, type, folderId });
  } catch (err) {
    if (err.code === 'NO_GOOGLE_TOKENS') return res.status(401).json({ error: err.message, code: err.code });
    next(err);
  }
});

// GET /api/drive/config → IDs configurados (debug/diagnóstico, sin auth de admin)
router.get('/config', authenticate, (_req, res) => {
  res.json({
    folders: {
      DELIVERY:   !!FOLDER_IDS.DELIVERY,
      RETURN:     !!FOLDER_IDS.RETURN,
      RETIREMENT: !!FOLDER_IDS.RETIREMENT,
    },
  });
});

module.exports = router;
