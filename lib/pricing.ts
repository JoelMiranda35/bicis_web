const PRICING = {
  ROAD: {
    "1-3": 30, // 30.00€
    "4-9": 27,
    "10+": 25,
    deposit: 150, // 150.00€
  },
  ROAD_PREMIUM: {
    "1-3": 50,
    "4-9": 47,
    "10+": 42,
    deposit: 150,
  },
  MTB: {
    "1-3": 20,
    "4-9": 17,
    "10+": 15,
    deposit: 80,
  },
  CITY_BIKE: {
    "1-3": 20,
    "4-9": 17,
    "10+": 15,
    deposit: 80,
  },
  E_CITY_BIKE: {
    "1-3": 25,
    "4-9": 22,
    "10+": 18,
    deposit: 80,
  },
  E_MTB: {
    "1-3": 60,
    "4-9": 55,
    "10+": 50,
    deposit: 150,
  },
} as const;


export const INSURANCE_PRICE_PER_DAY = 5; // 5.00€ en céntimos
export const INSURANCE_MAX_PRICE = 25; // 25.00€

export type BikeCategory = keyof typeof PRICING;

export function isValidCategory(category: string): category is BikeCategory {
  return category in PRICING;
}

export function calculatePrice(category: string, days: number): number {
  if (days <= 0) return 0;

  if (!isValidCategory(category)) {
    //console.error(`Categoría no válida: ${category}`);
    return 0;
  }

  const pricing = PRICING[category];

  if (days <= 3) return pricing["1-3"];
  if (days <= 9) return pricing["4-9"];
  return pricing["10+"];
}

export function calculateDeposit(category: string): number {
  if (!isValidCategory(category)) {
    //console.error(`Categoría no válida para depósito: ${category}`);
    return 0;
  }
  return PRICING[category].deposit;
}

export function calculateInsurance(days: number): number {
  if (days <= 0) return 0;
  return Math.min(INSURANCE_PRICE_PER_DAY * days, INSURANCE_MAX_PRICE);
}

// Función auxiliar para mostrar precios en formato legible
export function formatPrice(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2) + "€";
}