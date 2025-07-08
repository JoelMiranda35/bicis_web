export function validateDNI(dni: string): boolean {
  // Remove spaces and convert to uppercase
  const cleanDNI = dni.replace(/\s/g, "").toUpperCase()

  // Spanish DNI validation
  const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/
  if (dniRegex.test(cleanDNI)) {
    const numbers = cleanDNI.slice(0, 8)
    const letter = cleanDNI.slice(8)
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE"
    const expectedLetter = letters[Number.parseInt(numbers) % 23]
    return letter === expectedLetter
  }

  // Spanish NIE validation
  const nieRegex = /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/
  if (nieRegex.test(cleanDNI)) {
    let numbers = cleanDNI.slice(1, 8)
    const letter = cleanDNI.slice(8)
    const firstChar = cleanDNI.charAt(0)

    // Convert first character to number
    if (firstChar === "X") numbers = "0" + numbers
    else if (firstChar === "Y") numbers = "1" + numbers
    else if (firstChar === "Z") numbers = "2" + numbers

    const letters = "TRWAGMYFPDXBNJZSQVHLCKE"
    const expectedLetter = letters[Number.parseInt(numbers) % 23]
    return letter === expectedLetter
  }

  return false
}

export function validatePassport(passport: string): boolean {
  // Basic passport validation - alphanumeric, 6-12 characters
  const passportRegex = /^[A-Z0-9]{6,12}$/
  return passportRegex.test(passport.replace(/\s/g, "").toUpperCase())
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  // International phone number validation
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/
  const cleanPhone = phone.replace(/[\s\-$$$$]/g, "")
  return phoneRegex.test(cleanPhone) && cleanPhone.length >= 9
}

export function validateDocument(document: string): { isValid: boolean; type: "dni" | "nie" | "passport" | null } {
  const cleanDoc = document.replace(/\s/g, "").toUpperCase()

  if (validateDNI(cleanDoc)) {
    if (cleanDoc.match(/^[0-9]{8}[A-Z]$/)) {
      return { isValid: true, type: "dni" }
    } else {
      return { isValid: true, type: "nie" }
    }
  }

  if (validatePassport(cleanDoc)) {
    return { isValid: true, type: "passport" }
  }

  return { isValid: false, type: null }
}
