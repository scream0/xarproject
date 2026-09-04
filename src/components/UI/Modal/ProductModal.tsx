// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import styles from "./ProductModal.module.css";
import modalData from "@/data/ui/productModalConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";

export function Modal({ isOpen, item, onClose, onAddToCart, rupiah }) {
  const { activePromo } = useStore();
  const [currentSize, setCurrentSize] = useState("");
  const [modalQty, setModalQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);

  useEffect(() => {
    if (!item) return;

    const availableVariants =
      item?.variants?.filter((v: any) => (v.stock ?? 0) > 0) || [];

    if (availableVariants.length > 0) {
      const currentIsStillAvailable = availableVariants.find(
        (v: any) => v.size === currentSize,
      );

      if (!currentIsStillAvailable) {
        const firstAvailable = availableVariants[0];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentSize(firstAvailable.size);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedVariant(firstAvailable);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setModalQty(1);
      }
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentSize("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedVariant(null);
    }
  }, [item, currentSize]);

  useEffect(() => {
    if (!item?.id) return;
    setReviews([]);
    setReviewsPage(1);
    setHasMoreReviews(true);
    fetchReviews(1);
  }, [item?.id]);

  const fetchReviews = (pageToFetch: any) => {
    setLoadingReviews(true);
    fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/reviews?productId=${item.id}&public=true&page=${pageToFetch}&limit=10`)
      .then((res) => res.json())
      .then((data) => {
        const newReviews = data.reviews || [];
        if (pageToFetch === 1) {
          setReviews(newReviews);
        } else {
          setReviews((prev) => [...prev, ...newReviews]);
        }
        setHasMoreReviews(newReviews.length === 10);
      })
      .catch((err) => console.error("Failed to fetch reviews", err))
      .finally(() => setLoadingReviews(false));
  };

  const handleLoadMoreReviews = () => {
    const nextPage = reviewsPage + 1;
    setReviewsPage(nextPage);
    fetchReviews(nextPage);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 400);
  };

  if (!isOpen || !item) return null;
  if (!isOpen && !isClosing) return null;

  const handleSizeChange = (variant: any) => {
    setCurrentSize(variant.size);
    setSelectedVariant(variant);
    setModalQty(1);
  };

  const handleAddToCart = () => {
    if (selectedVariant) {
      onAddToCart(item, selectedVariant, modalQty);
      onClose();
    }
  };

  // LOGIKA GAMBAR DINAMIS TERPUSAT:
  // Prioritaskan gambar dari varian, lalu image_url / imageUrl dari database/item utama.
  const displayedImage =
    selectedVariant?.image_url ||
    selectedVariant?.imageUrl ||
    item?.image_url ||
    item?.imageUrl ||
    "/assets/placeholder.jpg";

  const formatRupiah = (val: any) => {
    if (rupiah) return rupiah(val);
    return `Rp ${Number(val).toLocaleString("id-ID")}`;
  };

  return (
    <div
      className={`${styles.modalOverlay} ${
        isOpen && !isClosing ? styles.modalActive : ""
      } ${isClosing ? styles.modalClosing : ""}`}
      onClick={handleClose}
    >
      <div
        className={styles.modalContentWrapper}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={styles.modalCloseBtn}
          onClick={handleClose}
          aria-label={modalData?.accessibility?.closeAriaLabel}
        >
          <AppIcon name={modalData?.icons?.close} className={styles.feather} />
        </button>

        <div className={styles.modalGrid}>
          <div className={styles.modalImageBox}>
            <img
              src={displayedImage}
              alt={item.name}
              className={styles.modalMainImg}
            />
          </div>

          <div className={styles.modalInfoBox}>
            <span className={styles.modalCategoryTag}>
              {item.category || "Parfum"}
            </span>
            <h2 className={styles.modalProductTitle}>{item.name}</h2>

            <div className={styles.modalPriceTag}>
              {(() => {
                const rawPrice = selectedVariant
                  ? Number(selectedVariant.price)
                  : item.price
                    ? Number(item.price)
                    : 0;
                const discounted = getDiscountedPrice(rawPrice, activePromo);
                if (rawPrice <= 0) return <span className={styles.modalPriceValue}>Stok Habis</span>;
                return (
                  <>
                    {discounted.hasDiscount && (
                      <span className={styles.modalOriginalPrice}>
                        {formatRupiah(discounted.originalPrice)}
                      </span>
                    )}
                    <span className={styles.modalPriceValue}>
                      {formatRupiah(discounted.price)}
                    </span>
                    {discounted.hasDiscount && (
                      <span className={styles.modalDiscountBadge}>
                        Hemat {formatRupiah(discounted.savings)}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>

            <p className={styles.modalProductDesc}>
              {item.description || "Deskripsi produk belum tersedia."}
            </p>

            {/* Pilihan Varian */}
            {item.variants?.length > 0 && (
              <div className={styles.modalVariantSection}>
                <h4>{modalData?.labels?.variant || "Pilih Ukuran / Varian"}</h4>
                <div className={styles.variantPillGroup}>
                  {item.variants.map((v: any) => {
                    const stock = v.stock ?? 0;
                    const isOutOfStock = stock <= 0;
                    return (
                      <label
                        key={v.size}
                        className={`${styles.variantPill} ${
                          currentSize === v.size ? styles.pillActive : ""
                        } ${isOutOfStock ? styles.disabledPill : ""}`}
                      >
                        <input
                          type="radio"
                          name="modal-size"
                          value={v.size}
                          disabled={isOutOfStock}
                          checked={currentSize === v.size}
                          onChange={() => handleSizeChange(v)}
                          style={{ display: "none" }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                          }}
                        >
                          <span>{v.size}</span>
                          <small style={{ fontSize: "0.65rem", opacity: 0.8 }}>
                            {isOutOfStock ? "Habis" : `Stok: ${stock}`}
                          </small>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Qty & Add to Cart */}
            <div className={styles.modalActionRow}>
              <div className={styles.modalQtyBox}>
                <button
                  className={styles.modalQtyBtn}
                  onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                  disabled={!selectedVariant || modalQty <= 1}
                  aria-label="Kurangi jumlah pesanan"
                >
                  {modalData?.labels?.quantityMinus || "-"}
                </button>
                <span className={styles.modalQtyValue}>{modalQty}</span>
                <button
                  className={styles.modalQtyBtn}
                  onClick={() =>
                    setModalQty(
                      Math.min(selectedVariant?.stock ?? 1, modalQty + 1),
                    )
                  }
                  disabled={
                    !selectedVariant ||
                    modalQty >= (selectedVariant?.stock ?? 1)
                  }
                  aria-label="Tambah jumlah pesanan"
                >
                  {modalData?.labels?.quantityPlus || "+"}
                </button>
              </div>

              <button
                className={styles.modalAddToCartBtn}
                onClick={handleAddToCart}
                disabled={!selectedVariant}
              >
                {selectedVariant
                  ? modalData?.labels?.addToCart || "Tambah ke Keranjang"
                  : "Stok Habis"}
              </button>
            </div>

            {/* --- REVIEWS SECTION --- */}
            <div className={styles.reviewsSection}>
              <h4 className={styles.reviewsTitle}>Ulasan Pembeli</h4>
              {loadingReviews ? (
                <p className={styles.noReviews}>Memuat ulasan...</p>
              ) : reviews.length > 0 ? (
                <div className={styles.reviewList}>
                  {reviews.map((rev) => (
                    <div key={rev.id} className={styles.reviewItem}>
                      <div className={styles.reviewHeader}>
                        <span className={styles.reviewUser}>
                          {rev.userName || "Pelanggan"}
                        </span>
                        <span className={styles.reviewDate}>
                          {new Date(rev.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className={styles.reviewStars}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <AppIcon
                            key={i}
                            name="star"
                            size={12}
                            strokeWidth={i < rev.rating ? 2.5 : 1}
                            style={{
                              fill: i < rev.rating ? "#fbbf24" : "none",
                              color: i < rev.rating ? "#fbbf24" : "#9ca3af",
                            }}
                          />
                        ))}
                      </div>
                      <p className={styles.reviewComment}>{rev.comment}</p>
                      {rev.reviewPhoto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rev.reviewPhoto}
                          alt="Review"
                          className={styles.reviewImage}
                        />
                      )}
                    </div>
                  ))}
                  {hasMoreReviews && (
                    <button
                      className={styles.modalAddToCartBtn}
                      style={{ marginTop: '1rem', background: 'var(--surface-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                      onClick={handleLoadMoreReviews}
                      disabled={loadingReviews}
                    >
                      {loadingReviews ? "Memuat..." : "Muat Lebih Banyak Ulasan"}
                    </button>
                  )}
                </div>
              ) : (
                <p className={styles.noReviews}>Belum ada ulasan untuk produk ini.</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
