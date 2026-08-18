"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/UI/Modal/ProductModal";
import { useStore } from "@/context/StoreContext";
import Shop from '@/components/Dashboard/User/Shop/Shop';

type ProductLike = {
  id?: string;
  name?: string;
  [key: string]: unknown;
};

const Contact = dynamic(() => import('@/components/Contact/Contact').then(mod => mod.Contact), {
  loading: () => <p>Loading Contact Form...</p>, // Optional loading component
  ssr: false, // This is allowed in a Client Component
});

// This component contains the client-side logic for the shop and product modal.
export function HomePageClient({ initialData }) {
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
