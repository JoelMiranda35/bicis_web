// lib/pricing-db.ts
import { supabase } from "@/lib/supabase";

export interface PricingData {
  id: string;
  category: string;
  price_1_3: number;
  price_4_9: number;
  price_10_plus: number;
  deposit: number;
  created_at: string;
  updated_at: string;
}

export async function getPricingFromDB(): Promise<PricingData[]> {
  console.log("🔵 getPricingFromDB - consultando Supabase...");
  const { data, error } = await supabase
    .from("pricing")
    .select("*")
    .order("category", { ascending: true });

  if (error) {
    console.error("🔴 Error fetching pricing:", error);
    return [];
  }
  console.log("🔵 getPricingFromDB - datos recibidos:", data);
  return data || [];
}

export async function getPricingByCategory(category: string): Promise<PricingData | null> {
  const { data, error } = await supabase
    .from("pricing")
    .select("*")
    .eq("category", category)
    .single();

  if (error) {
    console.error(`Error fetching pricing for ${category}:`, error);
    return null;
  }
  return data;
}

// 🔥 NUEVA VERSIÓN - ACTUALIZA POR ID
export async function updatePricingById(
  id: string,
  prices: {
    price_1_3: number;
    price_4_9: number;
    price_10_plus: number;
    deposit: number;
  }
): Promise<{ success: boolean; error?: string }> {
  console.log("🟡 updatePricingById - recibido:", { id, prices });
  
  try {
    // 🔥 ACTUALIZAR POR ID (LA CLAVE PRIMARIA)
    const { data, error } = await supabase
      .from("pricing")
      .update({
        price_1_3: prices.price_1_3,
        price_4_9: prices.price_4_9,
        price_10_plus: prices.price_10_plus,
        deposit: prices.deposit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    console.log("🟡 updatePricingById - respuesta de Supabase:", { data, error });

    if (error) {
      console.error("🔴 Error de Supabase:", error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      console.error("🔴 No se actualizó ningún registro");
      return { success: false, error: "No se encontró el registro con ese ID" };
    }

    console.log("✅ Registro actualizado:", data[0]);
    return { success: true };
  } catch (error: any) {
    console.error("🔴 Error en updatePricingById:", error);
    return { success: false, error: error.message };
  }
}

// Mantener la función vieja por compatibilidad pero usar la nueva
export async function updatePricing(
  category: string,
  prices: {
    price_1_3: number;
    price_4_9: number;
    price_10_plus: number;
    deposit: number;
  }
): Promise<{ success: boolean; error?: string }> {
  console.log("⚠️ updatePricing está obsoleto, usa updatePricingById");
  // Primero obtener el ID de la categoría
  const pricing = await getPricingByCategory(category);
  if (!pricing) {
    return { success: false, error: `Categoría ${category} no encontrada` };
  }
  return updatePricingById(pricing.id, prices);
}