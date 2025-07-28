export const PRICING = {
  ROAD: {
    "1-3": 3000, // 30.00€ en céntimos
    "4-9": 2700,
    "10+": 2500,
    deposit: 15000, // 150.00€
  },
  ROAD_PREMIUM: {
    "1-3": 5000,
    "4-9": 4700,
    "10+": 4200,
    deposit: 15000,
  },
  MTB: {
    "1-3": 2000,
    "4-9": 1700,
    "10+": 1500,
    deposit: 8000,
  },
  CITY_BIKE: {
    "1-3": 2000,
    "4-9": 1700,
    "10+": 1500,
    deposit: 8000,
  },
  E_CITY_BIKE: {
    "1-3": 2500,
    "4-9": 2200,
    "10+": 1800,
    deposit: 8000,
  },
  E_MTB: {
    "1-3": 6000,
    "4-9": 5500,
    "10+": 5000,
    deposit: 15000,
  },
} as const;

export const INSURANCE_PRICE_PER_DAY = 500; // 5.00€ en céntimos
export const INSURANCE_MAX_PRICE = 2500; // 25.00€

export type BikeCategory = keyof typeof PRICING;

export function isValidCategory(category: string): category is BikeCategory {
  return category in PRICING;
}

export function calculatePrice(category: string, days: number): number {
  if (days <= 0) return 0;

  if (!isValidCategory(category)) {
    console.error(`Categoría no válida: ${category}`);
    return 0;
  }

  const pricing = PRICING[category];

  if (days <= 3) return pricing["1-3"];
  if (days <= 9) return pricing["4-9"];
  return pricing["10+"];
}

export function calculateDeposit(category: string): number {
  if (!isValidCategory(category)) {
    console.error(`Categoría no válida para depósito: ${category}`);
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