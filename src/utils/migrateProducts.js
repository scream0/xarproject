
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/firebaseAdmin";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function migrateProducts() {
  console.log("Starting product migration from Supabase to Firestore...");

  // 1. Fetch all products from Supabase
  const { data: supabaseProducts, error: supabaseError } = await supabase
    .from("products")
    .select("*");

  if (supabaseError) {
    console.error("Error fetching products from Supabase:", supabaseError);
    return;
  }

  if (!supabaseProducts || supabaseProducts.length === 0) {
    console.log("No products found in Supabase. Migration not needed.");
    return;
  }

  console.log(`Found ${supabaseProducts.length} products in Supabase.`);

  // 2. Write products to Firestore
  const productsRef = db.collection("products");
  const batch = db.batch();
  let migrationCount = 0;

  for (const product of supabaseProducts) {
    const firestoreDocRef = productsRef.doc(String(product.id));
    const doc = await firestoreDocRef.get();

    if (!doc.exists) {
      batch.set(firestoreDocRef, {
        ...product,
        createdAt: new Date(product.created_at),
        updatedAt: new Date(),
      });
      migrationCount++;
    }
  }

  if (migrationCount > 0) {
    await batch.commit();
    console.log(`Successfully migrated ${migrationCount} new products to Firestore.`);
  } else {
    console.log("All products already exist in Firestore. No migration needed.");
  }
}
