// Traduce errores conocidos de Prisma a mensajes claros en español.
// Devuelve null si no es un error conocido (el caller usa su fallback).
const LABELS = {
  serialNumber: 'número de serie', barcode: 'código de barras', tag: 'TAG',
  slug: 'código', email: 'email', imei: 'IMEI', macWifi: 'MAC WiFi', macEth: 'MAC Ethernet',
};

function friendlyPrismaError(err) {
  if (!err || !err.code) return null;
  if (err.code === 'P2002') {
    const raw = err.meta?.target;
    const fields = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const f = fields.map(x => LABELS[x] || x).join(', ') || 'valor único';
    return `Ya existe un registro con ese ${f}. Ese dato debe ser único — revisá el valor cargado.`;
  }
  if (err.code === 'P2003') return 'Referencia inválida: el registro vinculado no existe.';
  if (err.code === 'P2025') return 'Registro no encontrado.';
  return null;
}

module.exports = { friendlyPrismaError };
