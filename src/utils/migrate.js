// src/utils/migrate.js
import { db } from "@/lib/firebaseClient";
import { collection, addDoc } from "firebase/firestore";
import data from "@/data/db/products.json";

export const migrateData = async () => {
  // Selalu tanya konfirmasi sebelum hapus/tambah data
  if (
    !confirm(
      "Yakin ingin melakukan migrasi? Pastikan koleksi 'products' di Firestore sudah dikosongkan!",
    )
  )
    return;

  try {
    const productsCollection = collection(db, "products");
    let count = 0;

    for (const item of data.produkItems) {
      // Hapus ID lama dari JSON
      const { id, ...itemData } = item;

      // Tambahkan default field untuk fitur Sold Out & Status
      const dataToUpload = {
        ...itemData,
        stock: 10, // Default stock awal
        isAvailable: true,
        createdAt: new Date().toISOString(),
      };

      // addDoc otomatis membuatkan Auto-ID
      await addDoc(productsCollection, dataToUpload);
      count++;
      console.log(`Berhasil migrasi: ${item.name}`);
    }

    alert(`Sukses! ${count} produk telah dimigrasi dengan Auto-ID.`);
  } catch (error) {
    console.error("Gagal migrasi:", error);
    alert("Terjadi kesalahan, cek console!");
  }
};
