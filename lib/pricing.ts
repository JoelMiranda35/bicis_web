// lib/pricing.ts
import { getPricingByCategory } from "./pricing-db";

// ============================================
// 📊 PRECIOS ESTÁTICOS (FALLBACK)
// ============================================

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
    "1-3": 15,
    "4-9": 12,
    "10+": 10,
    deposit: 80,
  },
  CITY_BIKE: {
    "1-3": 15,
    "4-9": 12,
    "10+": 10,
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
  SCOOTER_MOVILIDAD: {
    "1-3": 20,
    "4-9": 17,
    "10+": 12,
    deposit: 200,
  },
} as const;

// ============================================
// 📦 CONSTANTES DE SEGURO
// ============================================

export const INSURANCE_PRICE_PER_DAY = 5; // 5.00€
export const INSURANCE_MAX_PRICE = 25; // 25.00€

// ============================================
// 🏷️ TIPOS
// ============================================

export type BikeCategory = keyof typeof PRICING;

// ============================================
// 🔧 FUNCIONES SÍNCRONAS (USAN PRECIOS ESTÁTICOS)
// ============================================

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

export function formatPrice(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2) + "€";
}

// ============================================
// 🌐 FUNCIONES ASÍNCRONAS (LEEN DESDE DB CON FALLBACK)
// ============================================

/**
 * Obtiene el precio desde la base de datos
 * Si falla, usa el precio estático como fallback
 */
export async function getPriceFromDB(category: string, days: number): Promise<number> {
  if (days <= 0) return 0;
  if (!isValidCategory(category)) return 0;

  try {
    const pricing = await getPricingByCategory(category);
    
    if (pricing) {
      let priceInCents: number;
      if (days <= 3) priceInCents = pricing.price_1_3;
      else if (days <= 9) priceInCents = pricing.price_4_9;
      else priceInCents = pricing.price_10_plus;
      
      return priceInCents / 100;
    }
  } catch (error) {
    console.error(`Error fetching price for ${category} from DB, using fallback:`, error);
  }

  return calculatePrice(category, days);
}

/**
 * Obtiene el depósito desde la base de datos
 * Si falla, usa el depósito estático como fallback
 */
export async function getDepositFromDB(category: string): Promise<number> {
  if (!isValidCategory(category)) return 0;

  try {
    const pricing = await getPricingByCategory(category);
    if (pricing) {
      return pricing.deposit / 100;
    }
  } catch (error) {
    console.error(`Error fetching deposit for ${category} from DB, using fallback:`, error);
  }

  return calculateDeposit(category);
}

/**
 * Versión async de calculatePrice que lee desde DB
 * Útil para el admin al crear reservas
 */
export async function calculatePriceAsync(category: string, days: number): Promise<number> {
  return getPriceFromDB(category, days);
}

/**
 * Versión async de calculateDeposit que lee desde DB
 */
export async function calculateDepositAsync(category: string): Promise<number> {
  return getDepositFromDB(category);
}

/**
 * Obtiene todos los precios desde la base de datos con sus nombres
 * Útil para mostrar en el admin o para precargar
 */
export async function getAllPricesFromDB(): Promise<Record<string, { 
  price_1_3: number; 
  price_4_9: number; 
  price_10_plus: number; 
  deposit: number;
}>> {
  try {
    const { getPricingFromDB } = await import("./pricing-db");
    const data = await getPricingFromDB();
    
    const result: Record<string, { price_1_3: number; price_4_9: number; price_10_plus: number; deposit: number }> = {};
    
    data.forEach(item => {
      result[item.category] = {
        price_1_3: item.price_1_3 / 100,
        price_4_9: item.price_4_9 / 100,
        price_10_plus: item.price_10_plus / 100,
        deposit: item.deposit / 100,
      };
    });
    
    return result;
  } catch (error) {
    console.error("Error fetching all prices from DB:", error);
    return {};
  }
}