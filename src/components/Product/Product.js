"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { useProductFilter } from "@/hooks/useProductFilter";
import { useStore } from "@/context/StoreContext";
import { getPublicSettings } from "@/services/settingsService";
import { getDiscountedPrice } from "@/utils/promo";
import { Swiper, SwiperSlide, useSwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";

// Import CSS Modules
import styles from "./Product.module.css";
import sliderStyles from "./ProductSlider.module.css";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Import UI Config JSON (fallback)
import productData from "@/data/ui/productConfig.json";

function SlideWrapper({ children }) {
  const swiperSlide = useSwiperSlide();
  return (
    <div className="swiper-slide">
      <div
        className={`${sliderStyles.visualWrapper} ${
          swiperSlide.isActive ? sliderStyles.activeVisual : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function Product({ onBukaDetail }) {
  const { products, addToCart, rupiah, activePromo } = useStore();
  const [resolvedHeader, setResolvedHeader] = useState(productData?.header);

  // Swiper Navigation & Pagination Refs (Menghindari konflik selector global)
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const paginationRef = useRef(null);

  // Menyesuaikan struktur data produk terpusat dari API/Store
  const productList = Array.isArray(products)
    ? products
    : products?.data || products?.produkItems || [];

  const { kategoriItems, currentCategory, setCurrentCategory, filteredItems } =
    useProductFilter(productList);

  // Bug Fix 1: useEffect dengan Unmount Guard
  useEffect(() => {
    let isMounted = true;

    const fetchSectionSettings = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!isMounted || !data) return;

        // Header section produk dari settings DB (fallback ke JSON)
        if (data?.product?.header) {
          setResolvedHeader({
            ...(productData?.header || {}),
            ...data.product.header,
            title: {
              ...(productData?.header?.title || {}),
              ...(data.product.header?.title || {}),
            },
          });
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load product section settings", error);
        }
      }
    };

    fetchSectionSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddToCart = useCallback(
    (item, variant) => addToCart(item, variant),
    [addToCart],
  );
  const handleDetail = useCallback(
    (item) => onBukaDetail?.(item),
    [onBukaDetail],
  );

  // Design Enhancement: Skeleton Loading Cards pas !products
  if (!products) {
    return (
      <section className={styles.product}>
        <div className={styles.productHeader}>
          <h5>{resolvedHeader?.tagline || "Loading..."}</h5>
          <h2>Loading Produk...</h2>
        </div>
        <div className={styles.skeletonGrid}>
          {[1, 2, 3].map((n) => (
            <div key={n} className={styles.skeletonCard}>
              <div className={styles.skeletonImagePulse} />
              <div className={styles.skeletonLinePulse} />
              <div className={styles.skeletonLineShortPulse} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Pesan jika produk tidak ditemukan (Data Driven dari JSON)
  if (!filteredItems || filteredItems.length === 0) {
    return (
      <div className={styles.productEmpty}>
        {productData.messages?.empty || "Produk tidak ditemukan."}
      </div>
    );
  }

  return (
    <section id="product" className={styles.product}>
      {/* Header Data Driven (DB override JSON) */}
      <div className={styles.productHeader}>
        <h5>{resolvedHeader?.tagline}</h5>
        <h2>
          {resolvedHeader?.title?.main}{" "}
          <span>{resolvedHeader?.title?.highlight}</span>
        </h2>
      </div>

      {/* Design Enhancement: Filter Tabs dengan Pill Indicator */}
      <div className={styles.produkFilterTabs}>
        {kategoriItems.map((kat) => (
          <button
            key={kat}
            className={`${styles.filterTab} ${
              currentCategory === kat ? styles.active : ""
            }`}
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
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        pagination={{
          el: paginationRef.current,
          clickable: true,
        }}
        onBeforeInit={(swiper) => {
          swiper.params.navigation.prevEl = prevRef.current;
          swiper.params.navigation.nextEl = nextRef.current;
          swiper.params.pagination.el = paginationRef.current;
        }}
        onInit={(swiper) => {
          swiper.navigation.init();
          swiper.navigation.update();
          swiper.pagination.init();
          swiper.pagination.update();
        }}
        breakpoints={{
          768: { slidesPerView: 3 },
          1024: { slidesPerView: 3 },
        }}
        className={sliderStyles.mySwiper}
      >
        {filteredItems.map((item) => (
          <SwiperSlide key={item.id || item._id}>
            <SlideWrapper>
              <ProductCard
                item={item}
                onDetail={handleDetail}
                onAdd={handleAddToCart}
                rupiah={rupiah}
                activePromo={activePromo}
              />
            </SlideWrapper>
          </SwiperSlide>
        ))}

        {/* Bug Fix 4: Swiper Controls pakai useRef instance */}
        <div className={sliderStyles.swiperControlsContainer}>
          <div ref={prevRef} className="swiper-button-prev" />
          <div ref={paginationRef} className="swiper-pagination" />
          <div ref={nextRef} className="swiper-button-next" />
        </div>
      </Swiper>
    </section>
  );
}

function ProductCard({ item, onDetail, onAdd, rupiah, activePromo }) {
  const availableVariants =
    item.variants?.filter((v) => (v.stock ?? 0) > 0) || [];
  const isSoldOut =
    item.variants && item.variants.length > 0 && availableVariants.length === 0;

  // Bug Fix 2: Menggunakan nullish coalescing (??) agar harga 0 (gratis) tetap valid
  const price =
    availableVariants[0]?.price ?? item.variants?.[0]?.price ?? item.price ?? 0;

  // Hitung harga diskon jika promo aktif
  const discounted = getDiscountedPrice(price, activePromo);

  // LOGIKA GAMBAR KARTU PRODUK TERPUSAT:
  const rawImageSrc =
    availableVariants[0]?.image_url ||
    availableVariants[0]?.imageUrl ||
    item.image_url ||
    item.imageUrl ||
    (item.image ? `/assets/produk/${item.image}` : "/assets/placeholder.jpg");

  // Bug Fix 3: Image Error Fallback State
  const [imageSrc, setImageSrc] = useState(rawImageSrc);

  useEffect(() => {
    setImageSrc(rawImageSrc);
  }, [rawImageSrc]);

  const formatRupiah = (val) => {
    if (rupiah) return rupiah(val);
    return `Rp ${Number(val).toLocaleString("id-ID")}`;
  };

  // Hitung persentase diskon untuk badge (opsional jika discounted.hasDiscount)
  const discountPercentage = discounted.hasDiscount && price > 0
    ? Math.round(((price - discounted.price) / price) * 100)
    : 0;

  return (
    <div
      className={`${styles.productCard} ${isSoldOut ? styles.soldOutCard : ""}`}
    >
      <div
        className={styles.productImageContainer}
        onClick={() => !isSoldOut && onDetail(item)}
        style={{ cursor: isSoldOut ? "default" : "pointer" }}
      >
        {/* Design Enhancement: Badge Diskon & Hover Zoom */}
        {discounted.hasDiscount && discountPercentage > 0 && !isSoldOut && (
          <span className={styles.discountBadge}>-{discountPercentage}%</span>
        )}

        <img
          src={imageSrc}
          alt={item.name}
          onError={() => setImageSrc("/assets/placeholder.jpg")}
          className={`${styles.productImage} ${
            isSoldOut ? styles.grayscale : ""
          }`}
          loading="lazy"
        />
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
              {discounted.hasDiscount ? (
                <>
                  <span className={styles.originalPrice}>
                    {formatRupiah(discounted.originalPrice)}
                  </span>
                  <span className={styles.currentPrice}>
                    {formatRupiah(discounted.price)}
                  </span>
                </>
              ) : (
                <span className={styles.currentPrice}>
                  {formatRupiah(discounted.price)}
                </span>
              )}
            </>
          )}
        </div>

        <button
          className={styles.btnQuickAdd}
          onClick={() =>
            !isSoldOut &&
            onAdd(item, availableVariants[0] ?? item.variants?.[0] ?? { price })
          }
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