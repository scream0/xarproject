import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardView from "./DashboardView";

// Re-add revalidation
export const revalidate = 60; // Revalidate every 60 seconds

async function getProducts() {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching products:", error);
    // In a real app, you might want to throw the error or handle it differently
    return [];
  }
  return data;
}

export default async function DashboardPage() {
  const initialProducts = await getProducts();
  return <DashboardView initialProducts={initialProducts} />;
}
