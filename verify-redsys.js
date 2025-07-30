const crypto = require('crypto');

// 1. Configuración REAL (verifica estos valores)
const REDSYS_SECRET_KEY = "JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG"; // Clave REAL de pruebas
const REDSYS_MERCHANT_CODE = "367064094";
const REDSYS_TERMINAL = "001";

// 2. Parámetros de tu transacción REAL
const paramsB64Real = "eyJEU19NRVJDSEFOVF9BTU9VTlQiOiI0MDAwIiwiRFNfTUVSQ0hBTlRfT1JERVIiOiI2NzcwNjUzNDI1MjQiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiIzNjcwNjQwOTQiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6IjAwMSIsIkRTX01FUkNIQU5UX01FUkNIQU5UVVJMIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vYXBpL25vdGlmaWNhdGlvbiIsIkRTX01FUkNIQU5UX1VSTE9LIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1leGl0b3NhP29yZGVyPTY3NzA2NTM0MjUyNCIsIkRTX01FUkNIQU5UX1VSTEtLIjoiaHR0cHM6Ly93d3cuYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1mYWxsaWRhP29yZGVyPTY3NzA2NTM0MjUyNCIsIkRTX01FUkNIQU5UX0NPTlNVTUVSTEFOR1VBR0UiOiIwMDIiLCJEU19NRVJDSEFOVF9QUk9EVUNUREVTQ1JJUFRJT04iOiJBbHF1aWxlciBkZSBiaWNpY2xldGFzIn0=";
const firmaRecibida = "iBXFsUxjNnUE6OZQSUDQfldwXbosjJeKXURXeExPDSc=";

// 3. Función CORREGIDA para generar clave HMAC
function generarClaveHMAC(claveSecreta, codigoComercio, terminal) {
    const claveBuffer = Buffer.from(claveSecreta, 'base64');
    const iv = Buffer.alloc(8, 0);
    
    // Preparamos los datos con padding explícito
    const datos = codigoComercio + terminal;
    const blockSize = 8;
    const padLength = blockSize - (datos.length % blockSize);
    const paddedData = datos + '\0'.repeat(padLength);
    
    // Cifrado 3DES-CBC
    const cipher = crypto.createCipheriv('des-ede3-cbc', claveBuffer, iv);
    cipher.setAutoPadding(false); // Importante: padding manual
    
    let cifrado = cipher.update(paddedData, 'utf8', 'hex');
    cifrado += cipher.final('hex');
    
    return Buffer.from(cifrado, 'hex');
}

// 4. Función para calcular firma (correcta)
function calcularFirma(paramsBase64, claveHMAC) {
    const hmac = crypto.createHmac('sha256', claveHMAC);
    hmac.update(paramsBase64);
    return hmac.digest('base64');
}

// 5. Ejecución y verificación
try {
    console.log("=== Validación de Firma Redsys ===");
    
    // Generar clave HMAC
    const claveHMAC = generarClaveHMAC(REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE, REDSYS_TERMINAL);
    console.log("Clave HMAC generada:", claveHMAC.toString('hex'));
    
    // Calcular firma
    const firmaCalculada = calcularFirma(paramsB64Real, claveHMAC);
    console.log("\nFirma calculada:", firmaCalculada);
    console.log("Firma recibida:", firmaRecibida);
    
    // Verificación
    const coinciden = firmaCalculada === firmaRecibida;
    console.log("\nResultado:", coinciden ? "✅ FIRMA VÁLIDA" : "❌ FIRMA INVÁLIDA");
    
    if (!coinciden) {
        console.log("\n🔍 Análisis de discrepancia:");
        console.log("1. Verifica que la clave secreta sea EXACTAMENTE:", REDSYS_SECRET_KEY);
        console.log("2. Los parámetros deben ser IDÉNTICOS a los enviados a Redsys");
        console.log("3. Asegúrate de usar la misma codificación Base64");
        
        console.log("\n📄 Parámetros decodificados:", Buffer.from(paramsB64Real, 'base64').toString('utf8'));
    }
} catch (error) {
    console.error("❌ Error crítico:", error.message);
    console.error("Stack trace:", error.stack);
}