"use client";
import { useState, useEffect } from "react";
import styles from "./ProductModal.module.css";
import modalData from "@/data/ui/productModalConfig.json";

export function Modal({ isOpen, item, onClose, onAddToCart, rupiah }) {
  const [currentSize, setCurrentSize] = useState("");
  const [modalQty, setModalQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  // Reset state saat item berubah atau ukuran terpilih berubah
  useEffect(() => {
    if (!item) return;

    const availableVariants =
      item?.variants?.filter((v) => (v.stock ?? 0) > 0) || [];

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
  }, [item, currentSize]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 400);
  };

  if (!isOpen || !item) return null;
  if (!isOpen && !isClosing) return null;

  const handleSizeChange = (variant) => {
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

  const formatRupiah = (val) => {
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
          <svg className={styles.feather}>
            <use
              href={`/assets/icon/feather-sprite.svg#${modalData?.icons?.close}`}
            />
          </svg>
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
              <span className={styles.modalPriceValue}>
                {selectedVariant
                  ? formatRupiah(selectedVariant.price)
                  : item.price
                    ? formatRupiah(item.price)
                    : "Stok Habis"}
              </span>
            </div>

            <p className={styles.modalProductDesc}>
              {item.description || "Deskripsi produk belum tersedia."}
            </p>

            {/* Pilihan Varian */}
            {item.variants?.length > 0 && (
              <div className={styles.modalVariantSection}>
                <h4>{modalData?.labels?.variant || "Pilih Ukuran / Varian"}</h4>
                <div className={styles.variantPillGroup}>
                  {item.variants.map((v) => {
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
          </div>
        </div>
      </div>
    </div>
  );
}
