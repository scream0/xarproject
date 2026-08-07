"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar/Navbar";
import { Hero } from "@/components/Hero/Hero";
import { About } from "@/components/About/About";
import { Product } from "@/components/Product/Product";
import { Contact } from "@/components/Contact/Contact";
import { Footer } from "@/components/Footer/Footer";
import { Modal } from "@/components/UI/Modal/ProductModal";
import { useStore } from "@/context/StoreContext";
import VoucherCard from "@/components/Voucher/VoucherCard"; // New import

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
  const [publicVouchers, setPublicVouchers] = useState([]); // New state

  // New useEffect to fetch public vouchers
  useEffect(() => {
    const fetchPublicVouchers = async () => {
      try {
        const res = await fetch("/api/vouchers/public");
        const data = await res.json();
        if (res.ok && data.success) {
          setPublicVouchers(data.vouchers);
        } else {
          console.error("Failed to fetch public vouchers:", data.error);
        }
      } catch (error) {
        console.error("Error fetching public vouchers:", error);
      }
    };
    fetchPublicVouchers();
  }, []); // Run once on mount

  const bukaDetail = (item: any) => {
    setSelectedProduct(item);
    setIsModalOpen(true);
  };

  const handleClaimVoucher = async (voucher) => {
    // This part requires user authentication, which isn't present on landing page
    // For now, I will just log. A real implementation would require a login flow.
    // Or this button on the landing page could redirect to login/register.
    console.log("Attempting to claim voucher:", voucher.vouchers?.code || voucher.code);
    alert("Silakan login untuk mengklaim voucher ini.");
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

        {/* New Vouchers Section */}
        {publicVouchers.length > 0 && (
          <FadeInSection delay={0.3}>
            <section style={{ padding: "4rem 0", background: "var(--surface)" }}>
              <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>
                <h2 style={{ fontSize: "2.2rem", fontWeight: 700, textAlign: "center", marginBottom: "2rem", color: "var(--text-primary)" }}>
                  Voucher Menarik Untukmu
                </h2>
                <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem" }}>
                  {publicVouchers.map((voucher) => (
                    <VoucherCard key={voucher.id} voucher={voucher} onActionClick={handleClaimVoucher} buttonText="Klaim Sekarang" />
                  ))}
                </div>
              </div>
            </section>
          </FadeInSection>
        )}
        {/* End New Vouchers Section */}

        <FadeInSection delay={0.4}> {/* Adjusted delay */}
          <Product onBukaDetail={bukaDetail} />
        </FadeInSection>
        <FadeInSection delay={0.4}> {/* Adjusted delay */}
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
