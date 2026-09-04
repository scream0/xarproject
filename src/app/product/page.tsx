"use client";

import { useState, useEffect, Suspense } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import styles from "./ProductDetail.module.css";
import modalData from "@/data/ui/productModalConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import toast from "react-hot-toast";

interface Variant {
  size: string;
  price: number;
  stock?: number;
  stok?: number;
  image_url?: string;
  imageUrl?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  imageUrl?: string;
  variants: Variant[];
  category: string;
  price?: number;
}

function ProductDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();

  const { activePromo, addToCart } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  const [currentSize, setCurrentSize] = useState("");
  const [modalQty, setModalQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id || id === 'undefined') return;

    setLoading(true);
    fetch(`/api/products?id=${id}`)
      .then(async res => {
        if (res.status === 404) {
          setIsNotFound(true);
          throw new Error('Produk tidak ditemukan.');
        }
        if (!res.ok) {
          throw new Error(`Gagal memuat detail produk (Status: ${res.status})`);
        }
        return res.json();
      })
      .then(data => {
        const productData = Array.isArray(data.data) ? data.data[0] : data.data;

        if (data.success && productData) {
          setProduct(productData);
        } else {
          setIsNotFound(true);
          throw new Error('Produk tidak ditemukan.');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching product:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!product) return;

    const availableVariants =
      product?.variants?.filter((v) => ((v.stock ?? v.stok ?? 0) > 0)) || [];

    if (availableVariants.length > 0) {
      const currentIsStillAvailable = availableVariants.find(
        (v) => v.size === currentSize,
      );

      if (!currentIsStillAvailable) {
        const firstAvailable = availableVariants[0];
        setCurrentSize(firstAvailable.size);
        setSelectedVariant(firstAvailable);
        setModalQty(1);
      }
    } else {
      setCurrentSize("");
      setSelectedVariant(null);
    }
  }, [product, currentSize]);

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Memuat detail produk...</p>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    notFound();
  }

  if (error) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.errorCard}>
          <h3 className={styles.errorTitle}>Terjadi Kesalahan</h3>
          <p className={styles.errorDesc}>{error}</p>
          <p className={styles.errorId}>ID Produk: {id}</p>
          <button 
            type="button"
            onClick={() => router.back()}
            className={styles.backButton}
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const handleSizeChange = (variant: Variant) => {
    const stock = variant.stock ?? variant.stok ?? 0;
    if (stock <= 0) return;
    setCurrentSize(variant.size);
    setSelectedVariant(variant);
    setModalQty(1);
  };

  const handleAddToCart = async () => {
    if (!selectedVariant || isSubmitting) return;

    const currentStock = selectedVariant.stock ?? selectedVariant.stok ?? 0;
    if (currentStock <= 0) {
      toast.error('Maaf, varian/ukuran ini sudah habis stoknya.');
      return;
    }

    if (modalQty > currentStock) {
      toast.error(`Jumlah melebihi stok yang tersedia (${currentStock} item).`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addToCart(product, selectedVariant, modalQty);
    } catch (err: any) {
      console.error("Gagal menambahkan ke keranjang:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedImage =
    selectedVariant?.image_url ||
    selectedVariant?.imageUrl ||
    product?.image_url ||
    product?.imageUrl ||
    "/assets/placeholder.jpg";

  const formatRupiah = (val: number) => {
    return `Rp ${Number(val).toLocaleString("id-ID")}`;
  };

  const isSelectedVariantOutOfStock = (selectedVariant?.stock ?? selectedVariant?.stok ?? 0) <= 0;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        
        {/* Tombol Back */}
        <div className={styles.backButtonWrapper}>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.backButton}
          >
            {/* Properti size ditambahkan untuk menghindari error TypeScript */}
            <AppIcon name="arrow-left" size={20} className={styles.backIcon} />
            <span>Kembali</span>
          </button>
        </div>

        <div className={styles.gridContainer}>
          
          {/* Kotak Gambar */}
          <div className={styles.imageBox}>
            <Image
              src={displayedImage}
              alt={product.name}
              width={500}
              height={550}
              priority
              className={styles.mainImg}
            />
          </div>

          {/* Kotak Informasi Produk */}
          <div className={styles.infoBox}>
            <div>
              <span className={styles.categoryTag}>
                {product.category || "Parfum"}
              </span>
              <h1 className={styles.productTitle}>{product.name}</h1>

              <div className={styles.priceTag}>
                {(() => {
                  const rawPrice = selectedVariant
                    ? Number(selectedVariant.price)
                    : product.price
                    ? Number(product.price)
                    : 0;
                  const discounted = getDiscountedPrice(rawPrice, activePromo);
                  if (rawPrice <= 0 || isSelectedVariantOutOfStock) return <span className={styles.outOfStockText}>Stok Habis</span>;
                  return (
                    <>
                      {discounted.hasDiscount && (
                        <span className={styles.originalPrice}>
                          {formatRupiah(discounted.originalPrice)}
                        </span>
                      )}
                      <span className={styles.priceValue}>
                        {formatRupiah(discounted.price)}
                      </span>
                      {discounted.hasDiscount && (
                        <span className={styles.discountBadge}>
                          Hemat {formatRupiah(discounted.savings)}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              <p className={styles.productDesc}>
                {product.description || "Deskripsi produk belum tersedia."}
              </p>

              {/* Pilihan Varian */}
              {product.variants?.length > 0 && (
                <div className={styles.variantSection}>
                  <h4>{modalData?.labels?.variant || "Pilih Ukuran / Varian"}</h4>
                  <div className={styles.variantPillGroup}>
                    {product.variants.map((v) => {
                      const stock = v.stock ?? v.stok ?? 0;
                      const isOutOfStock = stock <= 0;
                      const isSelected = currentSize === v.size;
                      return (
                        <button
                          type="button"
                          key={v.size}
                          disabled={isOutOfStock}
                          onClick={() => handleSizeChange(v)}
                          className={`${styles.variantPill} ${
                            isSelected ? styles.pillActive : ""
                          } ${isOutOfStock ? styles.disabledPill : ""}`}
                        >
                          <span>{v.size}</span>
                          <span className={styles.variantStockLabel}>
                            {isOutOfStock ? "Habis" : `Stok: ${stock}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Qty & Add to Cart */}
            <div className={styles.actionRow}>
              <div className={styles.qtyBox}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                  disabled={!selectedVariant || modalQty <= 1 || isSubmitting || isSelectedVariantOutOfStock}
                >
                  {modalData?.labels?.quantityMinus || "-"}
                </button>
                <span className={styles.qtyValue}>{modalQty}</span>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() =>
                    setModalQty(
                      Math.min(selectedVariant?.stock ?? selectedVariant?.stok ?? 1, modalQty + 1),
                    )
                  }
                  disabled={
                    !selectedVariant ||
                    modalQty >= (selectedVariant?.stock ?? selectedVariant?.stok ?? 1) ||
                    isSubmitting ||
                    isSelectedVariantOutOfStock
                  }
                >
                  {modalData?.labels?.quantityPlus || "+"}
                </button>
              </div>

              <button
                type="button"
                className={styles.addToCartBtn}
                onClick={handleAddToCart}
                disabled={!selectedVariant || isSelectedVariantOutOfStock || isSubmitting}
              >
                {isSubmitting
                  ? "Menyimpan..."
                  : !selectedVariant || isSelectedVariantOutOfStock
                  ? "Stok Habis"
                  : modalData?.labels?.addToCart || "Tambah ke Keranjang"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={
      <div className={styles.pageContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Memuat detail produk...</p>
        </div>
      </div>
    }>
      <ProductDetailContent />
    </Suspense>
  );
}