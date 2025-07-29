const crypto = require('crypto');

// Configuración desde tu .env
const REDSYS_SECRET_KEY = "JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG";
const REDSYS_MERCHANT_CODE = "367064094";
const REDSYS_TERMINAL = "001";

// Tus datos de Postman
const paramsB64 = "eyJEU19NRVJDSEFOVF9BTU9VTlQiOiIzMTAwIiwiRFNfTUVSQ0hBTlRfT1JERVIiOiIwMDAxMjM0NTY3ODkiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiIzNjcwNjQwOTQiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6IjAwMSIsIkRTX01FUkNIQU5UX01FUkNIQU5UVVJMIjoiaHR0cHM6Ly9hbHRlYWJpa2VzaG9wLmNvbS9hcGkvbm90aWZpY2F0aW9uIiwiRFNfTUVSQ0hBTlRfVVJMT0siOiJodHRwczovL2FsdGVhYmlrZXNob3AuY29tL3Jlc2VydmEtZXhpdG9zYT9vcmRlcj0wMDAxMjM0NTY3ODkiLCJEU19NRVJDSEFOVF9VUkxLTyI6Imh0dHBzOi8vYWx0ZWFiaWtlc2hvcC5jb20vcmVzZXJ2YS1mYWxsaWRhP29yZGVyPTAwMDEyMzQ1Njc4OSIsIkRTX01FUkNIQU5UX0NPTlNVTUVSTEFOR1VBR0UiOiIwMDIiLCJEU19NRVJDSEFOVF9QUk9EVUNUREVTQ1JJUFRJT04iOiJBbHF1aWxlciBkZSBiaWNpY2xldGFzIn0";

// 1. Generar clave HMAC (3DES)
const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64');
const iv = Buffer.alloc(8, 0);
const dataToEncrypt = REDSYS_MERCHANT_CODE + REDSYS_TERMINAL;

// ZeroPadding
const blockSize = 8;
const padLength = blockSize - (dataToEncrypt.length % blockSize);
const paddedData = dataToEncrypt + '\0'.repeat(padLength);

const cipher = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
cipher.setAutoPadding(false);
let encrypted = cipher.update(paddedData, 'utf8', 'hex');
encrypted += cipher.final('hex');
const hmacKey = Buffer.from(encrypted, 'hex');

// 2. Calcular firma
const hmac = crypto.createHmac('sha256', hmacKey);
hmac.update(paramsB64);
const calculatedSignature = hmac.digest('base64url');

// 3. Comparar con tu firma
const yourSignature = "xuolgUug7vBiqkw5_EKu6XourQsm7RKABOq9lZ3PIuw";

console.log("Clave HMAC generada:", hmacKey.toString('hex'));
console.log("Firma calculada:", calculatedSignature);
console.log("Firma recibida:", yourSignature);
console.log("Coinciden?", calculatedSignature === yourSignature);