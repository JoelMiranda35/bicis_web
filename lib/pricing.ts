export const PRICING = {
  ROAD: {
    "1-3": 30,
    "4-9": 27,
    "10+": 25,
    deposit: 150,
  },
  ROAD_PREMIUM: {
    "1-3": 50,
    "4-9": 47,
    "10+": 42,
    deposit: 150, // Asumo el mismo depósito que ROAD estándar
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

// Insurance is 5€ per day with a maximum of 25€ for 5+ days
export const INSURANCE_PRICE_PER_DAY = 5;
export const INSURANCE_MAX_PRICE = 25;

type BikeCategory = keyof typeof PRICING;

// Las funciones existentes no necesitan cambios ya que trabajan con el tipo BikeCategory
// que se actualiza automáticamente con las nuevas claves de PRICING

export function calculatePrice(category: BikeCategory, days: number): number {
  if (days <= 0) return 0;
  
  const pricing = PRICING[category];
  
  if (!pricing) {
    console.error(`Categoría no válida: ${category}`);
    return 0;
  }

  if (days <= 3) return pricing["1-3"];
  if (days <= 9) return pricing["4-9"];
  return pricing["10+"];
}

export function calculateDeposit(category: BikeCategory): number {
  return PRICING[category]?.deposit ?? 0;
}

export function calculateInsurance(days: number): number {
  if (days <= 0) return 0;
  return Math.min(INSURANCE_PRICE_PER_DAY * days, INSURANCE_MAX_PRICE);
}

export function isValidCategory(category: string): category is BikeCategory {
  return category in PRICING;
}