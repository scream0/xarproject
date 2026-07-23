"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { SearchForm } from "./SearchForm";
import { CartSidebar } from "../UI/Sidebar/CartSidebar";
import { Modal } from "../UI/Modal/ProductModal";
import styles from "./Navbar.module.css";
import config from "@/data/ui/navbarConfig.json";
import { Logo } from "@/components/UI/Logo/logo";

export function Navbar() {
  const [activePanel, setActivePanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const {
    products,
    addToCart,
    rupiah,
    cartQuantity,
    user,
    customer,
    logout,
    isCartOpen,
    setIsCartOpen,
  } = useStore();

  // Tentukan item mana yang harus ditampilkan berdasarkan status auth
  const getAuthItems = () => {
    const authConfig = config?.authSection?.auth;
    if (!authConfig) return [];
    return user
      ? authConfig.authenticated || []
      : authConfig.unauthenticated || [];
  };

  const authItems = getAuthItems();
  const navRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow =
      activePanel === "navbar" ? "hidden" : "unset";
  }, [activePanel]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (cartQuantity > 0) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 400);
      return () => clearTimeout(timer);
    }
  }, [cartQuantity]);

  // Menyesuaikan struktur data produk terpusat dari API/Store
  const productList = Array.isArray(products)
    ? products
    : products?.data || products?.produkItems || [];

  const filtered = productList.filter((p) =>
    p?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const togglePanel = (panelName) => {
    setActivePanel(activePanel === panelName ? null : panelName);
  };

  return (
    <>
      <nav
        className={`${styles.navbar} ${isScrolled ? styles.scrolled : ""} animate-navbar-load`}
        ref={navRef}
      >
        {/* LOGO DINAMIS */}
        <Link href={config.logo.href} className={styles.logo}>
          <Logo className={styles.logoSvg} />
          {config.logo.text}
          <span>{config.logo.subtext}</span>.
        </Link>

        {/* MENU DINAMIS SEBAGAI LINK */}
        <div
          className={`${styles.navbarNav} ${activePanel === "navbar" ? styles.active : ""}`}
        >
          {config.menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              onClick={() => setActivePanel(null)}
            >
              {item.label}
            </Link>
          ))}

          {/* USER AUTH SECTION DINAMIS */}
          <div className={styles.authSection}>
            {authItems.map((item, index) => {
              if (item.type === "text") {
                return (
                  <span key={index} className={styles.userName}>
                    {item.label.replace(
                      "{name}",
                      customer?.name || user?.email?.split("@")[0] || "User",
                    )}
                  </span>
                );
              }
              if (item.type === "link") {
                return (
                  <Link
                    key={index}
                    href={item.href}
                    className={styles.authLink}
                  >
                    {item.label}
                  </Link>
                );
              }
              if (item.type === "button" && item.action === "logout") {
                return (
                  <button
                    key={index}
                    onClick={logout}
                    className={styles.authLink}
                  >
                    {item.label}
                  </button>
                );
              }
              return null;
            })}
          </div>
        </div>

        <SearchForm
          isActive={activePanel === "search"}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredProdukItems={filtered}
          rupiah={rupiah}
          onResultClick={(item) => {
            setSelectedProduct(item);
            setIsModalOpen(true);
            setActivePanel(null);
            setSearchQuery("");
          }}
        />

        <CartSidebar />

        <div className={styles.navbarExtra}>
          {/* TOMBOL SEARCH */}
          <button
            onClick={() => togglePanel("search")}
            className="animate-elastic-bounce"
            aria-label="Cari Produk"
          >
            <svg className={styles.feather}>
              <use
                href={`/assets/icon/feather-sprite.svg#${config?.features?.search?.icon}`}
              />
            </svg>
          </button>

          {/* TOMBOL CART */}
          <button
            className={`${styles.cartButton} animate-elastic-bounce`}
            onClick={() => setIsCartOpen(!isCartOpen)}
            aria-label={config?.features?.cart?.ariaLabel}
          >
            <svg
              className={`${styles.feather} ${animate ? styles.cartBounce : ""}`}
            >
              <use
                href={`/assets/icon/feather-sprite.svg#${config?.features?.cart?.icon}`}
              />
            </svg>
            {isMounted && cartQuantity > 0 && (
              <span className={styles.quantityBadge}>{cartQuantity}</span>
            )}
          </button>

          {/* TOMBOL HAMBURGER */}
          <button
            onClick={() => togglePanel("navbar")}
            className={`${styles.hamburger} animate-elastic-bounce`}
            aria-label="Menu Navigasi"
          >
            <svg className={styles.feather}>
              <use
                href={`/assets/icon/feather-sprite.svg#${
                  activePanel === "navbar"
                    ? config?.features?.hamburger?.iconClose
                    : config?.features?.hamburger?.iconOpen
                }`}
              />
            </svg>
          </button>
        </div>
      </nav>

      <Modal
        isOpen={isModalOpen}
        item={selectedProduct}
        rupiah={rupiah}
        onClose={() => setIsModalOpen(false)}
        onAddToCart={(product, variant, quantity) => {
          addToCart(product, variant, quantity);
          setIsModalOpen(false);
        }}
      />
    </>
  );
}
