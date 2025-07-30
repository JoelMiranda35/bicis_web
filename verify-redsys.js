const crypto = require('crypto');

// Claves Redsys de pruebas
const REDSYS_SECRET_KEY = "JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG"; // pruebas
const REDSYS_MERCHANT_CODE = "367064094";
const REDSYS_TERMINAL = "001";

// Params reales de la transacción
// ✅ Pegá el nuevo valor actualizado y bien generado
const paramsB64 = "eyJEU19NRVJDSEFOVF9BTU9VTlQiOiIzMDAwIiwiRFNfTUVSQ0hBTlRfT1JERVIiOiI2MzM4MDAxODY4ODUiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiIzNjcwNjQwOTQiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6IjAwMSIsIkRTX01FUkNIQU5UX01FUkNIQU5UVVJMIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vYXBpL25vdGlmaWNhdGlvbiIsIkRTX01FUkNIQU5UX1VSTE9LIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1leGl0b3NhP29yZGVyPTYzMzgwMDE4Njg4NSIsIkRTX01FUkNIQU5UX1VSTEtPIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1mYWxsaWRhP29yZGVyPTYzMzgwMDE4Njg4NSIsIkRTX01FUkNIQU5UX0NPTlNVTUVSTEFOR1VBR0UiOiIwMDIiLCJEU19NRVJDSEFOVF9QUk9EVUNUREVTQ1JJUFRJT04iOiJBbHF1aWxlciBkZSBiaWNpY2xldGFzIn0=";
const firmaRecibida = "kLH0fPqKrX8gtZHUWPmEGncJ+80IkgCHBJL12ILW3E0=";


function generarClaveHMAC(claveSecreta, codigoComercio, terminal) {
    const claveBuffer = Buffer.from(claveSecreta, 'base64');
    const iv = Buffer.alloc(8, 0);

    const datos = codigoComercio + terminal;
    const paddedData = datos.padEnd(Math.ceil(datos.length / 8) * 8, '\0');

    const cipher = crypto.createCipheriv('des-ede3-cbc', claveBuffer, iv);
    cipher.setAutoPadding(false);
    const hmacKey = Buffer.concat([cipher.update(paddedData, 'utf8'), cipher.final()]);
    return hmacKey;
}

function calcularFirma(paramsBase64, claveHMAC) {
    const hmac = crypto.createHmac('sha256', claveHMAC);
    hmac.update(paramsBase64);
    return hmac.digest('base64');
}

try {
    console.log("=== Validación de Firma Redsys ===");

    const claveHMAC = generarClaveHMAC(REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE, REDSYS_TERMINAL);
    const firmaCalculada = calcularFirma(paramsB64, claveHMAC);

    console.log("Firma calculada:", firmaCalculada);
    console.log("Firma recibida: ", firmaRecibida);
    console.log(firmaCalculada === firmaRecibida ? "✅ FIRMA VÁLIDA" : "❌ FIRMA INVÁLIDA");

    const decoded = Buffer.from(paramsB64, 'base64').toString('utf8');
    console.log("\n📄 JSON de parámetros:\n", decoded);
} catch (err) {
    console.error("❌ Error:", err.message);
}
