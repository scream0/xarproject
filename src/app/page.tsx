
import { useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar/Navbar";
import { Hero } from "@/components/Hero/Hero";
import { About } from "@/components/About/About";
import { Contact } from "@/components/Contact/Contact";
import { Footer } from "@/components/Footer/Footer";
import { Modal } from "@/components/UI/Modal/ProductModal";
import { useStore } from "@/context/StoreContext";
import Shop from '@/components/Dashboard/User/Shop/Shop';

// Komponen Wrapper untuk animasi
const FadeInSection = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

export default async function Home() { // Make Home an async component for data fetching
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToCart, rupiah } = useStore();

  // Server-side fetch for initial products
  const fetchInitialProducts = async () => {
    // Make sure to use the absolute URL for server-side fetches
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/products`, { next: { revalidate: 3600 } }); // Added cache: 'no-store' for development, consider revalidate in production
    if (!res.ok) {
      console.error("Failed to fetch initial products:", res.status, res.statusText);
      return [];
    }
    const result = await res.json();
    return result.data || result.products || [];
  };

  const productsData = await fetchInitialProducts();

  const bukaDetail = (item: any) => {
    setSelectedProduct(item);
    setIsModalOpen(true);
  };

  return (
    <>
      <Navbar />
      <main>
        <FadeInSection delay={0.1}>
          <Hero />
        </FadeInSection>
        <FadeInSection delay={0.2}>
          <About />
        </FadeInSection>

        <FadeInSection delay={0.3}>
          <Shop onBukaDetail={bukaDetail} initialProducts={productsData} />
        </FadeInSection>
        <FadeInSection delay={0.3}>
          <Contact />
        </FadeInSection>
      </main>
      <FadeInSection delay={0.1}>
        <Footer />
      </FadeInSection>

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
    </>
  );
}