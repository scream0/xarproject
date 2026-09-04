import { useState, useMemo } from "react";

export const useProductFilter = (items = []) => {
  const [currentCategory, setCurrentCategory] = useState("Semua");

  // Membuat daftar kategori unik secara otomatis dari data Firestore
  const kategoriItems = useMemo(() => {
    const cats = new Set(items.map((item) => item.category || "Uncategorized"));
    return ["Semua", ...Array.from(cats)];
  }, [items]);

  // Melakukan filter secara otomatis setiap kali currentCategory atau items berubah
  const filteredItems = useMemo(() => {
    return currentCategory === "Semua"
      ? items
      : items.filter((item) => item.category === currentCategory);
  }, [currentCategory, items]);

  return {
    kategoriItems,
    currentCategory,
    setCurrentCategory,
    filteredItems,
  };
};
