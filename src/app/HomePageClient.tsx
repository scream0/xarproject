"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/UI/Modal/ProductModal";
import { useStore } from "@/context/StoreContext";
import Shop from '@/components/Dashboard/User/Shop/Shop';
import type { InitialDataType, Product } from '@/types/data'; // Import shared types

// The `ProductLike` type can still be useful here for props that accept a product-like object.
type ProductLike = Product & {
  [key: string]: unknown;
};

const Contact = dynamic(() => import('@/components/Contact/Contact').then(mod => mod.Contact), {
  loading: () => <p>Loading Contact Form...</p>, // Optional loading component
  ssr: false, // This is allowed in a Client Component
});

// This component contains the client-side logic for the shop and product modal.
export function HomePageClient({ initialData }: { initialData: InitialDataType }) {
  const [selectedProduct, setSelectedProduct] = useState<ProductLike | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToCart, rupiah } = useStore();

  const bukaDetail = (item: ProductLike) => {
    setSelectedProduct(item);
    setIsModalOpen(true);
  };

  return (
    <div>
      <div id="product">
        <Shop onBukaDetail={bukaDetail} initialData={initialData} />
      </div>

      {/* Modal Detail Produk */}
      {isModalOpen && selectedProduct && (
        <Modal
          isOpen={isModalOpen}
          item={selectedProduct}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={addToCart}
          rupiah={rupiah}
        />
      )}

      <Contact />
    </div>
  );
}
