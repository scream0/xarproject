"use client";
import { useState, useEffect } from "react";
import styles from "./Modal.module.css";
import modalData from "@/data/ui/modalConfig.json";

export function Modal({ isOpen, item, onClose, onAddToCart, rupiah }) {
  const [currentSize, setCurrentSize] = useState("");
  const [modalQty, setModalQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  // Reset state saat item berubah atau ukuran terpilih berubah
  useEffect(() => {
    const availableVariants =
      item?.variants?.filter((v) => (v.stock ?? 0) > 0) || [];

    if (availableVariants.length > 0) {
      // Cek apakah varian yang terpilih sekarang masih tersedia
      const currentIsStillAvailable = availableVariants.find(
        (v) => v.size === currentSize,
      );

      if (!currentIsStillAvailable) {
        // Jika varian terpilih sudah habis, pilih varian tersedia pertama
        const firstAvailable = availableVariants[0];
        setCurrentSize(firstAvailable.size);
        setSelectedVariant(firstAvailable);
        setModalQty(1);
      }
    } else {
      // Jika tidak ada stok sama sekali
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

  // LOGIKA GAMBAR DINAMIS:
  // Jika varian yang dipilih memiliki imageUrl sendiri, gunakan itu.
  // Jika tidak, fallback ke gambar utama produk (imageUrl / image_url).
  const displayedImage =
    selectedVariant?.imageUrl || item?.imageUrl || item?.image_url;

  return (
    <div
      className={`${styles.modalOverlay} ${isOpen && !isClosing ? styles.modalActive : ""} ${isClosing ? styles.modalClosing : ""}`}
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
            <span className={styles.modalCategoryTag}>{item.category}</span>
            <h2 className={styles.modalProductTitle}>{item.name}</h2>

            <div className={styles.modalPriceTag}>
              <span className={styles.modalPriceValue}>
                {selectedVariant ? rupiah(selectedVariant.price) : "Stok Habis"}
              </span>
            </div>

            <p className={styles.modalProductDesc}>{item.description}</p>

            {/* Pilihan Varian */}
            {item.variants?.length > 0 && (
              <div className={styles.modalVariantSection}>
                <h4>{modalData?.labels?.variant}</h4>
                <div className={styles.variantPillGroup}>
                  {item.variants.map((v) => {
                    const stock = v.stock ?? 0;
                    const isOutOfStock = stock <= 0;
                    return (
                      <label
                        key={v.size}
                        className={`${styles.variantPill} ${currentSize === v.size ? styles.pillActive : ""} ${isOutOfStock ? styles.disabledPill : ""}`}
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
                  {modalData?.labels?.quantityMinus}
                </button>
                <span className={styles.modalQtyValue}>{modalQty}</span>
                <button
                  className={styles.modalQtyBtn}
                  onClick={() =>
                    setModalQty(
                      Math.min(selectedVariant?.stock ?? 0, modalQty + 1),
                    )
                  }
                  disabled={
                    !selectedVariant ||
                    modalQty >= (selectedVariant?.stock ?? 0)
                  }
                >
                  {modalData?.labels?.quantityPlus}
                </button>
              </div>

              <button
                className={styles.modalAddToCartBtn}
                onClick={handleAddToCart}
                disabled={!selectedVariant}
              >
                {selectedVariant ? modalData?.labels?.addToCart : "Stok Habis"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
