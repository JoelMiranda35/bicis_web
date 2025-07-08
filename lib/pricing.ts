export const PRICING = {
  ROAD: {
    "1-3": 30,
    "4-9": 27,
    "10+": 25,
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
}

// Insurance is 5€ per day with a maximum of 25€ for 5+ days
export const INSURANCE_PRICE_PER_DAY = 5
export const INSURANCE_MAX_PRICE = 25

export function calculatePrice(category: keyof typeof PRICING, days: number): number {
  const prices = PRICING[category]
  if (days <= 3) return prices["1-3"]
  if (days <= 9) return prices["4-9"]
  return prices["10+"]
}

export function calculateDeposit(category: keyof typeof PRICING): number {
  return PRICING[category].deposit
}

export function calculateInsurance(days: number): number {
  return Math.min(INSURANCE_PRICE_PER_DAY * days, INSURANCE_MAX_PRICE)
}