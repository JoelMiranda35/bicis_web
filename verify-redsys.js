// verify-redsys.js
const crypto = require('crypto');

const REDSYS_SECRET_KEY    = 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG';
const REDSYS_MERCHANT_CODE = '367064094';
const REDSYS_TERMINAL      = '001';

// Usa exactamente estos valores de tu consola:
const paramsB64 = 'eyJEU19NRVJDSEFOVF9BTU9VTlQiOiIzMDAwIiwiRFNfTUVSQ0hBTlRfT1JERVIiOiIxMjM0NTY3ODkwMTQiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiIzNjcwNjQwOTQiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6IjAwMSIsIkRTX01FUkNIQU5UX01FUkNIQU5UVVJMIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vYXBpL25vdGlmaWNhdGlvbiIsIkRTX01FUkNIQU5UX1VSTE9LIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1leGl0b3NhP29yZGVyPTEyMzQ1Njc4OTAxNCIsIkRTX01FUkNIQU5UX1VSTEtPIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1mYWxsaWRhP29yZGVyPTEyMzQ1Njc4OTAxNCIsIkRTX01FUkNIQU5UX0NPTlNVTUVSTEFOR1VBR0UiOiIwMDIiLCJEU19NRVJDSEFOVF9QUk9EVUNUREVTQ1JJUFRJT04iOiJBbHF1aWxlciBkZSBiaWNpY2xldGFzIn0=';
const firmaRecibida = 'TZbhQe9Ay3ZQ+qMfybCR3qhjauOM70Rh92pFX1VusBc=';

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
