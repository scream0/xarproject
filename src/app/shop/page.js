"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { auth } from "@/lib/firebaseClient";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import styles from "./ShopPage.module.css";
import toast from "react-hot-toast";

// Import Konfigurasi JSON
import shopConfig from "@/data/ui/shopConfig.json";

const db = getFirestore();

export default function ShopPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [selectedVariants, setSelectedVariants] = useState({});
  const [userPrimaryAddress, setUserPrimaryAddress] = useState("Belum diatur");

  const currentUser = auth.currentUser;

  // 1. Load Midtrans Script
  useEffect(() => {
    const snapScriptUrl = "https://app.sandbox.midtrans.com/snap/snap.js";
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";

    if (!document.getElementById("midtrans-snap-script")) {
      const script = document.createElement("script");
      script.id = "midtrans-snap-script";
      script.src = snapScriptUrl;
      script.setAttribute("data-client-key", clientKey);
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // 2. Fetch User Primary Address
  useEffect(() => {
    async function fetchUserPrimaryAddress() {
      if (!currentUser) return;
      try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (
            data.addresses &&
            Array.isArray(data.addresses) &&
            data.addresses.length > 0
          ) {
            const primary =
              data.addresses.find((a) => a.isPrimary) || data.addresses[0];
            const formattedAddress = `${primary.label} - ${primary.recipientName} (${primary.recipientPhone}): ${primary.street}, ${primary.city} (${primary.postalCode})`;
            setUserPrimaryAddress(formattedAddress);
          } else if (data.shipping_address) {
            setUserPrimaryAddress(data.shipping_address);
          }
        }
      } catch (err) {
        console.error("Gagal memuat alamat utama:", err);
      }
    }
    fetchUserPrimaryAddress();
  }, [currentUser]);

  // 3. Fetch Products from Supabase
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const { data, error } = await supabase.from("products").select("*");
        if (error) throw error;

        setProducts(data || []);

        const initialVariants = {};
        (data || []).forEach((prod) => {
          if (prod.variants && prod.variants.length > 0) {
            initialVariants[prod.id] = 0;
          }
        });
        setSelectedVariants(initialVariants);
      } catch (err) {
        console.error("Gagal memuat katalog:", err);
        toast.error("Gagal memuat produk dari database.");
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // Kategori Dinamis dari Database
  const dynamicCategories = useMemo(() => {
    const categoriesSet = new Set();
    products.forEach((p) => {
      if (p.category) {
        categoriesSet.add(p.category.trim());
      }
    });
    return Array.from(categoriesSet);
  }, [products]);

  const handleVariantSelect = (productId, variantIdx) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [productId]: variantIdx,
    }));
  };

  // Filter & Sort Logic
  const processedProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== "all") {
      result = result.filter(
        (p) =>
          (p.category || "").toLowerCase().trim() ===
          selectedCategory.toLowerCase().trim(),
      );
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(query) ||
          (p.description || "").toLowerCase().includes(query),
      );
    }

    if (sortBy === "price-low") {
      result.sort((a, b) => {
        const priceA =
          a.variants?.[selectedVariants[a.id] ?? 0]?.price || a.price || 0;
        const priceB =
          b.variants?.[selectedVariants[b.id] ?? 0]?.price || b.price || 0;
        return priceA - priceB;
      });
    } else if (sortBy === "price-high") {
      result.sort((a, b) => {
        const priceA =
          a.variants?.[selectedVariants[a.id] ?? 0]?.price || a.price || 0;
        const priceB =
          b.variants?.[selectedVariants[b.id] ?? 0]?.price || b.price || 0;
        return priceB - priceA;
      });
    } else if (sortBy === "name") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return result;
  }, [products, selectedCategory, searchQuery, sortBy, selectedVariants]);

  // Checkout Midtrans
  const handleOrderNow = async (product) => {
    if (!currentUser) {
      toast.error(shopConfig.toast.loginRequired);
      router.push("/login");
      return;
    }

    const activeVariantIdx = selectedVariants[product.id] ?? 0;
    const variant = product.variants?.[activeVariantIdx] || {};
    const price = variant.price || product.price || 0;
    const sizeLabel = variant.size || "Standard 50ml";

    if (!price || price <= 0) {
      toast.error(shopConfig.toast.invalidPrice);
      return;
    }

    const toastId = toast.loading(shopConfig.toast.loadingMidtrans);

    try {
      const newOrderId =
        "MMK-SHP-" + Math.floor(100000 + Math.random() * 900000);
      const productNameFull = `${product.name} (${sizeLabel})`;

      const res = await fetch("/api/midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: newOrderId,
          amount: Number(price),
          productName: productNameFull,
          customerDetails: {
            first_name: currentUser.displayName || "Customer",
            email: currentUser.email || "customer@awrgaroma.com",
            phone: currentUser.phoneNumber || "08123456789",
          },
        }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Gagal membuat sesi pembayaran");

      toast.dismiss(toastId);

      if (window.snap) {
        window.snap.pay(result.token, {
          onSuccess: async function (resultData) {
            toast.success(shopConfig.toast.success);
            await saveOrderToSupabase(
              newOrderId,
              productNameFull,
              sizeLabel,
              price,
              "settlement",
              resultData.payment_type,
            );
          },
          onPending: async function (resultData) {
            toast(shopConfig.toast.pending, { icon: "⏳" });
            await saveOrderToSupabase(
              newOrderId,
              productNameFull,
              sizeLabel,
              price,
              "pending",
              resultData.payment_type || "Midtrans",
            );
          },
          onError: function () {
            toast.error(shopConfig.toast.error);
          },
          onClose: function () {
            toast(shopConfig.toast.closed);
          },
        });
      } else {
        throw new Error("Sistem pembayaran belum siap.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Gagal memproses pesanan.", { id: toastId });
    }
  };

  const saveOrderToSupabase = async (
    orderId,
    productName,
    concentration,
    price,
    status,
    paymentType,
  ) => {
    try {
      await supabase.from("orders").insert([
        {
          user_id: currentUser.uid,
          order_id: orderId,
          product_name: productName,
          concentration: concentration,
          notes: "Pembelian dari Shop Page E-Commerce",
          price: Number(price),
          status: status,
          payment_type: paymentType,
          shipping_address: userPrimaryAddress,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (dbErr) {
      console.error("Gagal simpan database:", dbErr);
    }
  };

  return (
    <div className={styles.shopContainer}>
      {/* Top Header Navigation */}
      <div className={styles.topNavHeader}>
        <button
          onClick={() => router.push("/dashboard")}
          className={styles.backDashboardBtn}
        >
          {shopConfig.backButton}
        </button>
        <span className={styles.brandWatermark}>{shopConfig.brandName}</span>
      </div>

      {/* Clean Header Banner */}
      <header className={styles.shopHeader}>
        <h1 className={styles.shopTitle}>{shopConfig.header.title}</h1>
        <p className={styles.shopSubtitle}>{shopConfig.header.subtitle}</p>
      </header>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.categoryGroup}>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`${styles.catBtn} ${selectedCategory === "all" ? styles.activeCatBtn : ""}`}
          >
            {shopConfig.filters.allLabel}
          </button>
          {dynamicCategories.map((kat) => (
            <button
              key={kat}
              onClick={() => setSelectedCategory(kat)}
              className={`${styles.catBtn} ${selectedCategory.toLowerCase() === kat.toLowerCase() ? styles.activeCatBtn : ""}`}
            >
              {kat}
            </button>
          ))}
        </div>

        <div className={styles.toolbarRight}>
          <input
            type="text"
            placeholder={shopConfig.filters.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={styles.sortSelect}
          >
            <option value="default">{shopConfig.filters.sortDefault}</option>
            <option value="price-low">{shopConfig.filters.sortPriceLow}</option>
            <option value="price-high">
              {shopConfig.filters.sortPriceHigh}
            </option>
            <option value="name">{shopConfig.filters.sortName}</option>
          </select>
        </div>
      </div>

      {/* Product Grid / Empty State */}
      {loading ? (
        <div className={styles.stateContainer}>
          <p>{shopConfig.messages.loading}</p>
        </div>
      ) : processedProducts.length === 0 ? (
        <div className={styles.stateContainer}>
          <p>{shopConfig.messages.empty}</p>
        </div>
      ) : (
        <div className={styles.productGrid}>
          {processedProducts.map((product) => {
            const activeVariantIdx = selectedVariants[product.id] ?? 0;
            const currentVariant = product.variants?.[activeVariantIdx] || {};
            const activePrice = currentVariant.price || product.price || 0;
            const priceFormatted = activePrice
              ? `Rp ${Number(activePrice).toLocaleString("id-ID")}`
              : shopConfig.card.fallbackPrice;

            return (
              <div key={product.id} className={styles.productCard}>
                <div className={styles.imageWrapper}>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className={styles.productImg}
                    />
                  ) : (
                    <div className={styles.placeholderImg}>
                      {shopConfig.card.placeholderImageText}
                    </div>
                  )}
                </div>

                <div className={styles.cardBody}>
                  <span className={styles.productCategory}>
                    {product.category || shopConfig.card.defaultCategory}
                  </span>
                  <h3 className={styles.productName}>{product.name}</h3>
                  <p className={styles.productDesc}>
                    {product.description || shopConfig.card.defaultDescription}
                  </p>

                  {product.variants && product.variants.length > 0 && (
                    <div className={styles.variantBox}>
                      <span className={styles.variantLabel}>
                        {shopConfig.card.variantLabel}
                      </span>
                      <div className={styles.variantChips}>
                        {product.variants.map((v, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleVariantSelect(product.id, idx)}
                            className={`${styles.chip} ${activeVariantIdx === idx ? styles.activeChip : ""}`}
                          >
                            {v.size || `Varian ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    <span className={styles.price}>{priceFormatted}</span>
                    <button
                      onClick={() => handleOrderNow(product)}
                      className={styles.buyBtn}
                    >
                      {shopConfig.card.buyButtonText}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
