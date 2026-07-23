"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar/Navbar";
import { Hero } from "@/components/Hero/Hero";
import { About } from "@/components/About/About";
import { Product } from "@/components/Product/Product";
import { Contact } from "@/components/Contact/Contact";
import { Footer } from "@/components/Footer/Footer";
import { Modal } from "@/components/UI/Modal/ProductModal";
import { AddressModal } from "@/components/UI/Modal/AddressModal"; // <-- Diimpor di sini
import { useStore } from "@/context/StoreContext";

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

export default function Home() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToCart, rupiah } = useStore();

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
        <FadeInSection delay={0.2}>
          <Product onBukaDetail={bukaDetail} />
        </FadeInSection>
        <FadeInSection delay={0.2}>
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

      {/* Modal Form Alamat Otomatis saat Checkout & Alamat Kosong */}
      <AddressModal />
    </>
  );
}
