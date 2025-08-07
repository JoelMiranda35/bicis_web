/**
 * Valida un nombre completo (solo letras y espacios, mínimo nombre y apellido)
 * @param name Nombre a validar
 * @returns boolean
 */
export function validateName(name: string): boolean {
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{2,}(?:\s+[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+)+$/;
  return nameRegex.test(name.trim()) && name.trim().length >= 5;
}

/**
 * Valida un DNI español (formato 12345678A)
 * @param dni DNI a validar
 * @returns boolean
 */
export function validateDNI(dni: string): boolean {
  // Remove spaces and convert to uppercase
  const cleanDNI = dni.replace(/\s/g, "").toUpperCase();

  // Spanish DNI validation
  const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/;
  if (dniRegex.test(cleanDNI)) {
    const numbers = cleanDNI.slice(0, 8);
    const letter = cleanDNI.slice(8);
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    const expectedLetter = letters[Number.parseInt(numbers) % 23];
    return letter === expectedLetter;
  }

  return false;
}

/**
 * Valida un NIE español (formato X1234567A)
 * @param nie NIE a validar
 * @returns boolean
 */
export function validateNIE(nie: string): boolean {
  // Remove spaces and convert to uppercase
  const cleanNIE = nie.replace(/\s/g, "").toUpperCase();

  // Spanish NIE validation
  const nieRegex = /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/;
  if (nieRegex.test(cleanNIE)) {
    let numbers = cleanNIE.slice(1, 8);
    const letter = cleanNIE.slice(8);
    const firstChar = cleanNIE.charAt(0);

    // Convert first character to number
    if (firstChar === "X") numbers = "0" + numbers;
    else if (firstChar === "Y") numbers = "1" + numbers;
    else if (firstChar === "Z") numbers = "2" + numbers;

    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    const expectedLetter = letters[Number.parseInt(numbers) % 23];
    return letter === expectedLetter;
  }

  return false;
}

/**
 * Valida un pasaporte (formato alfanumérico, 6-12 caracteres)
 * @param passport Pasaporte a validar
 * @returns boolean
 */
export function validatePassport(passport: string): boolean {
  // Basic passport validation - alphanumeric, 6-12 characters
  const passportRegex = /^[A-Z0-9]{6,12}$/;
  return passportRegex.test(passport.replace(/\s/g, "").toUpperCase());
}

/**
 * Valida un email (formato estándar con dominio válido)
 * @param email Email a validar
 * @returns boolean
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Valida un número de teléfono (formato internacional)
 * @param phone Teléfono a validar
 * @returns boolean
 */
export function validatePhone(phone: string): boolean {
  // International phone number validation
  const phoneRegex = /^\+?\d{1,3}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/;
  const cleanPhone = phone.replace(/[\s\-()]/g, "");
  return phoneRegex.test(cleanPhone) && cleanPhone.length >= 9;
}

/**
 * Valida un documento (DNI, NIE o pasaporte)
 * @param document Documento a validar
 * @returns { isValid: boolean, type: "dni" | "nie" | "passport" | null }
 */
export function validateDocument(document: string): { isValid: boolean; type: "dni" | "nie" | "passport" | null } {
  const cleanDoc = document.replace(/\s/g, "").toUpperCase();

  if (validateDNI(cleanDoc)) {
    return { isValid: true, type: "dni" };
  }

  if (validateNIE(cleanDoc)) {
    return { isValid: true, type: "nie" };
  }

  if (validatePassport(cleanDoc)) {
    return { isValid: true, type: "passport" };
  }

  return { isValid: false, type: null };
}

/**
 * Valida un código postal español (5 dígitos)
 * @param postalCode Código postal a validar
 * @returns boolean
 */
export function validatePostalCode(postalCode: string): boolean {
  const postalCodeRegex = /^(?:0[1-9]|[1-4]\d|5[0-2])\d{3}$/;
  return postalCodeRegex.test(postalCode.trim());
}
