// verify-redsys.js
const crypto = require('crypto');

const REDSYS_SECRET_KEY    = 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG';
const REDSYS_MERCHANT_CODE = '367064094';
const REDSYS_TERMINAL      = '1';

// Usa exactamente estos valores de tu consola:
const paramsB64 = 'eyJEU19NRVJDSEFOVF9BTU9VTlQiOiIzMDAwIiwiRFNfTUVSQ0hBTlRfT1JERVIiOiIxMjM0NTY3ODkxMjMiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiIzNjcwNjQwOTQiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6IjEiLCJEU19NRVJDSEFOVF9NRVJDSEFOVFVSTCI6Imh0dHBzOi8vd3d3LmFsdGVhYmlrZXNob3AuY29tL2FwaS9ub3RpZmljYXRpb24iLCJEU19NRVJDSEFOVF9VUkxPSyI6Imh0dHBzOi8vd3d3LmFsdGVhYmlrZXNob3AuY29tL3Jlc2VydmEtZXhpdG9zYT9vcmRlcj0xMjM0NTY3ODkxMjMiLCJEU19NRVJDSEFOVF9VUkxLTyI6Imh0dHBzOi8vd3d3LmFsdGVhYmlrZXNob3AuY29tL3Jlc2VydmEtZmFsbGlkYT9vcmRlcj0xMjM0NTY3ODkxMjMiLCJEU19NRVJDSEFOVF9DT05TVU1FUkxBTkdVQUdFIjoiMDAyIiwiRFNfTUVSQ0hBTlRfUFJPRFVDVERFU0NSSVBUSU9OIjoiQWxxdWlsZXIgZGUgYmljaWNsZXRhcyJ9';
const firmaRecibida = 'il/hP4PLyL5ZkGd5RcPEvyEhY2Z5W0W3uAe/KRLGtV8=';

/**
 * Genera la clave HMAC (3DES) como en tu backend
 */
function generarClaveHMAC(secretB64, code, term) {
  const key  = Buffer.from(secretB64, 'base64');
  const iv   = Buffer.alloc(8, 0);
  const datos     = code + term;                    // "367064094001"
  const padTo     = Math.ceil(datos.length / 8) * 8;
  const padded    = datos.padEnd(padTo, '\0');
  const cipher    = crypto.createCipheriv('des-ede3-cbc', key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded, 'utf8'), cipher.final()]);
}

/**
 * Calcula HMAC-SHA256 de paramsB64
 */
function calcularFirma(params, hmacKey) {
  const hmac = crypto.createHmac('sha256', hmacKey);
  hmac.update(params);
  return hmac.digest('base64');
}

// === Ejecución ===
const claveHMAC      = generarClaveHMAC(REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE, REDSYS_TERMINAL);
const firmaCalculada = calcularFirma(paramsB64, claveHMAC);

console.log('Firma calculada:', firmaCalculada);
console.log('Firma recibida :', firmaRecibida);
console.log(firmaCalculada === firmaRecibida
  ? '✅ FIRMA VÁLIDA'
  : '❌ FIRMA INVÁLIDA');
