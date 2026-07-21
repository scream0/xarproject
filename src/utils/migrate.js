// migrate.js
// Jalankan lokal: node migrate.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";
import serviceAccount from "./firebase-service-account.json" assert { type: "json" };

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const supabase = createClient(
  "https://gwdvcfuzwchnfrhnhaek.supabase.co",
  "PASTE_SERVICE_ROLE_KEY_DI_SINI", // jangan commit ke git!
);

async function migrate() {
  const snapshot = await db.collection("products").get();
  const rows = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      description: d.description || null,
      category: d.category || null,
      image: d.image || null,
      image_url: d.imageUrl || null,
      is_available: d.isAvailable ?? true,
      specs: d.specs || {},
      variants: (d.variants || []).map((v) => ({
        size: v.size,
        price: Number(v.price) || 0,
        stock: parseInt(v.stock, 10) || 0, // string "10" -> number 10
      })),
    };
  });

  const { error } = await supabase.from("products").insert(rows);
  if (error) {
    console.error("Migrasi gagal:", error);
  } else {
    console.log(`Berhasil migrasi ${rows.length} produk.`);
  }
}

migrate();
