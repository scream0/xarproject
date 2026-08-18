"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/UI/Modal/ProductModal";
import { useStore } from "@/context/StoreContext";
import Shop from '@/components/Dashboard/User/Shop/Shop';

// Type Definitions
type ProductVariant = {
  size: string;
  price: number;
  stock: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string;
  variants?: ProductVariant[]; // Variants can be optional
  created_at: string;
  total_sold?: number;
  price?: number; // Price can be optional, especially if variants exist
};

type SalesMap = {
  [productId: string]: number;
};

type Review = {
  id: string;
  product_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

type InitialDataType = {
  products: Product[];
  totalProducts: number;
  salesMap: SalesMap;
  reviews: Review[];
};

type ProductLike = Product & { // ProductLike extends Product
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
