const crypto = require('crypto');

// Configuración (usa tus valores reales)
const REDSYS_SECRET_KEY = "JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG"; // Ejemplo, usa tu clave real
const REDSYS_MERCHANT_CODE = "367064094";
const REDSYS_TERMINAL = "001";

// Parámetros de ejemplo (deberían ser los mismos que en tu error)
const paramsB64 = "eyJEU19NRVJDSEFOVF9BTU9VTlQiOiIzMTAwIiwiRFNfTUVSQ0hBTlRfT1JERVIiOiIwMDAxMjM0NTY3ODkiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiIzNjcwNjQwOTQiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6IjAwMSIsIkRTX01FUkNIQU5UX01FUkNIQU5UVVJMIjoiaHR0cHM6Ly9hbHRlYWJpa2VzaG9wLmNvbS9hcGkvbm90aWZpY2F0aW9uIiwiRFNfTUVSQ0hBTlRfVVJMT0siOiJodHRwczovL2FsdGVhYmlrZXNob3AuY29tL3Jlc2VydmEtZXhpdG9zYT9vcmRlcj0wMDAxMjM0NTY3ODkiLCJEU19NRVJDSEFOVF9VUkxLTyI6Imh0dHBzOi8vYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1mYWxsaWRhP29yZGVyPTAwMDEyMzQ1Njc4OSIsIkRTX01FUkNIQU5UX0NPTlNVTUVSTEFOR1VBR0UiOiIwMDIiLCJEU19NRVJDSEFOVF9QUk9EVUNUREVTQ1JJUFRJT04iOiJBbHF1aWxlciBkZSBiaWNpY2xldGFzIn0";

// 1. Generar clave HMAC (3DES)
function generateHmacKey(secretKey, merchantCode, terminal) {
    const desKey = Buffer.from(secretKey, 'base64');
    const iv = Buffer.alloc(8, 0);
    const dataToEncrypt = merchantCode + terminal;
    
    // ZeroPadding (múltiplo de 8 bytes)
    const blockSize = 8;
    const padLength = blockSize - (dataToEncrypt.length % blockSize);
    const paddedData = dataToEncrypt + '\0'.repeat(padLength);
    
    const cipher = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
    cipher.setAutoPadding(false);
    let encrypted = cipher.update(paddedData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return Buffer.from(encrypted, 'hex');
}

// 2. Calcular firma HMAC SHA256 (Base64 URL-safe)
function calculateSignature(paramsB64, hmacKey) {
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    
    // Convertir a Base64 URL-safe
    const signature = hmac.digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    
    return signature;
}

// Ejecución
const hmacKey = generateHmacKey(REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE, REDSYS_TERMINAL);
const calculatedSignature = calculateSignature(paramsB64, hmacKey);
const yourSignature = "xuolgUug7vBiqkw5_EKu6XourQsm7RKABOq9lZ3PIuw";

console.log("Clave HMAC generada:", hmacKey.toString('hex'));
console.log("Firma calculada:", calculatedSignature);
console.log("Firma recibida:", yourSignature);
console.log("Coinciden?", calculatedSignature === yourSignature);