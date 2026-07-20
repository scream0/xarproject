"use client";
import { useCallback } from "react";
import { useProductFilter } from "@/hooks/useProductFilter";
import { useStore } from "@/context/StoreContext";
import { Swiper, SwiperSlide, useSwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";

// Import CSS Modules
import styles from "./Product.module.css";
import sliderStyles from "./ProductSlider.module.css";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Import UI Config JSON
import productData from "@/data/ui/productConfig.json";

function SlideWrapper({ children }) {
  const swiperSlide = useSwiperSlide();
  return (
    <div className="swiper-slide">
      <div
        className={`${sliderStyles.visualWrapper} ${swiperSlide.isActive ? sliderStyles.activeVisual : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

export function Product({ onBukaDetail }) {
  const { products, addToCart, rupiah } = useStore();
  const { kategoriItems, currentCategory, setCurrentCategory, filteredItems } =
    useProductFilter(products);

  const handleAddToCart = useCallback(
    (item, variant) => addToCart(item, variant),
    [addToCart],
  );
  const handleDetail = useCallback(
    (item) => onBukaDetail?.(item),
    [onBukaDetail],
  );

  // Loading State
  if (!products || products.length === 0) {
    return <div className={styles.productEmpty}>Loading...</div>;
  }

  // Pesan jika produk tidak ditemukan (Data Driven dari JSON)
  if (!filteredItems || filteredItems.length === 0) {
    return (
      <div className={styles.productEmpty}>{productData.messages.empty}</div>
    );
  }

  return (
    <section id="product" className={styles.product}>
      {/* Header Data Driven */}
      <div className={styles.productHeader}>
        <h5>{productData.header.tagline}</h5>
        <h2>
          {productData.header.title.main}{" "}
          <span>{productData.header.title.highlight}</span>
        </h2>
      </div>

      <div className={styles.produkFilterTabs}>
        {kategoriItems.map((kat) => (
          <button
            key={kat}
            className={`${styles.filterTab} ${currentCategory === kat ? styles.active : ""}`}
            onClick={() => setCurrentCategory(kat)}
          >
            {kat}
          </button>
        ))}
      </div>

      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={20}
        slidesPerView={1}
        speed={800}
        grabCursor={true}
        centeredSlides={true}
        observer={true}
        observeParents={true}
        navigation={{
          nextEl: ".swiper-button-next",
          prevEl: ".swiper-button-prev",
        }}
        pagination={{ el: ".swiper-pagination", clickable: true }}
        breakpoints={{
          768: { slidesPerView: 3 },
          1024: { slidesPerView: 3 },
        }}
        className={sliderStyles.mySwiper}
      >
        {filteredItems.map((item) => (
          <SwiperSlide key={item.id}>
            <SlideWrapper>
              <ProductCard
                item={item}
                onDetail={handleDetail}
                onAdd={handleAddToCart}
                rupiah={rupiah}
              />
            </SlideWrapper>
          </SwiperSlide>
        ))}

        <div className={sliderStyles.swiperControlsContainer}>
          <div className="swiper-button-prev" />
          <div className="swiper-pagination" />
          <div className="swiper-button-next" />
        </div>
      </Swiper>
    </section>
  );
}

function ProductCard({ item, onDetail, onAdd, rupiah }) {
  // Stok sekarang ada di level varian, bukan di level produk.
  // Produk dianggap tersedia kalau minimal 1 varian stoknya > 0.
  const availableVariants =
    item.variants?.filter((v) => (v.stock ?? 0) > 0) || [];
  const isSoldOut = availableVariants.length === 0;

  // Harga yang ditampilkan harus dari varian pertama yang stoknya masih ada,
  // bukan varian pertama secara mentah (yang bisa saja stoknya 0).
  const price = availableVariants[0]?.price ?? item.price ?? 0;

  const imageSrc =
    item.imageUrl ||
    (item.image ? `/assets/produk/${item.image}` : "/assets/placeholder.jpg");

  return (
    <div
      className={`${styles.productCard} ${isSoldOut ? styles.soldOutCard : ""}`}
    >
      <div
        className={styles.productImageContainer}
        onClick={() => !isSoldOut && onDetail(item)}
        style={{ cursor: isSoldOut ? "default" : "pointer" }}
      >
        <img
          src={imageSrc}
          alt={item.name}
          className={`${styles.productImage} ${isSoldOut ? styles.grayscale : ""}`}
          loading="lazy"
        />
        {/* Badge Sold Out Data Driven */}
        {isSoldOut && (
          <div className={styles.soldOutBadge}>
            {productData.card.soldOutBadge}
          </div>
        )}
      </div>

      <div className={styles.productContent}>
        <h3>{item.name}</h3>

        <div className={styles.productPrice}>
          {isSoldOut ? (
            <span className={styles.soldOutText}>
              {productData.card.unavailableText}
            </span>
          ) : (
            <>
              <span
                style={{ fontSize: "0.75rem", color: "#888", display: "block" }}
              >
                {productData.card.pricePrefix}
              </span>
              <span className={styles.currentPrice}>{rupiah(price)}</span>
            </>
          )}
        </div>

        <button
          className={styles.btnQuickAdd}
          onClick={() => !isSoldOut && onAdd(item, availableVariants[0])}
          disabled={isSoldOut}
        >
          {isSoldOut
            ? productData.card.soldOutText
            : productData.card.quickAddText}
        </button>
      </div>
    </div>
  );
}
