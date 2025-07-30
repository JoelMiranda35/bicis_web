const crypto = require('crypto');

// Configuración PROPORCIONADA POR REDSYS
const REDSYS_SECRET_KEY = "JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG";
const REDSYS_MERCHANT_CODE = "367064094";
const REDSYS_TERMINAL = "001";

// Parámetros de ejemplo DE REDSYS (base64)
const paramsB64Ejemplo = "eyJEU19NRVJDSEFOVF9BTU9VTlQiOiI1MDAwIiwiRFNfTUVSQ0hBTlRfT1JERVIiOiI0MzgwMjg2NDA0MDAiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiIzNjcwNjQwOTQiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6IjAwMSIsIkRTX01FUkNIQU5UX01FUkNIQU5UVVJMIjoiaHR0cHM6Ly9hbHRlYWJpa2VzaG9wLmNvbS9hcGkvbm90aWZpY2F0aW9uIiwiRFNfTUVSQ0hBTlRfVVJMT0siOiJodHRwczovL2FsdGVhYmlrZXNob3AuY29tL3Jlc2VydmEtZXhpdG9zYT9vcmRlcj00MzgwMjg2NDA0MDAiLCJEU19NRVJDSEFOVF9VUkxLTyI6Imh0dHBzOi8vYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1mYWxsaWRhP29yZGVyPTQzODAyODY0MDQwMCIsIkRTX01FUkNIQU5UX0NPTlNVTUVSTEFOR1VBR0UiOiIwMDIiLCJEU19NRVJDSEFOVF9QUk9EVUNUREVTQ1JJUFRJT04iOiJBbHF1aWxlciBkZSBiaWNpY2xldGFzIn0=";

// Firma ESPERADA por Redsys
const firmaEsperada = "QsGVX/q4G78qgNrJGRF+5OyvvOHXMdDf3x5KlbZAsGc=";

// --- Funciones (las mismas que usas) ---
function generarClaveHMAC(claveSecreta, codigoComercio, terminal) {
    const claveBuffer = Buffer.from(claveSecreta, 'base64');
    const iv = Buffer.alloc(8, 0);
    const datos = codigoComercio + terminal;
    const padding = 8 - (datos.length % 8);
    const datosConPadding = datos + '\0'.repeat(padding);
    
    const cipher = crypto.createCipheriv('des-ede3-cbc', claveBuffer, iv);
    cipher.setAutoPadding(false);
    let cifrado = cipher.update(datosConPadding, 'utf8', 'hex');
    cifrado += cipher.final('hex');
    return Buffer.from(cifrado, 'hex');
}

function calcularFirma(paramsBase64, claveHMAC) {
    const hmac = crypto.createHmac('sha256', claveHMAC);
    hmac.update(paramsBase64);
    return hmac.digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// --- Prueba con datos de Redsys ---
const claveHMAC = generarClaveHMAC(REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE, REDSYS_TERMINAL);
const firmaCalculada = calcularFirma(paramsB64Ejemplo, claveHMAC);

console.log("=== Prueba con Datos de Redsys ===");
console.log("Firma calculada:", firmaCalculada);
console.log("Firma esperada:", firmaEsperada);
console.log("¿Coinciden?", firmaCalculada === firmaEsperada ? "✅ SÍ" : "❌ NO");