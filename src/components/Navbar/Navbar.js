"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { useTheme } from "@/context/ThemeContext";
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const {
    products,
    addToCart,
    rupiah,
    cartQuantity,
    user,
    logout,
    isCartOpen,
    setIsCartOpen,
  } = useStore();
  
  const { theme, toggleTheme } = useTheme();

  const authItems = config?.authSection?.auth?.authenticated || [];
  const unauthItem = config?.authSection?.auth?.unauthenticated?.[0];

  const navRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = activePanel === "navbar" ? "hidden" : "unset";
  }, [activePanel]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const productList = Array.isArray(products) ? products : (products?.data || []);
  const filtered = productList.filter((p) => p?.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  const togglePanel = (panelName) => {
    setActivePanel(activePanel === panelName ? null : panelName);
  };

  return (
    <>
      <nav className={`${styles.navbar} ${isScrolled ? styles.scrolled : ""}`}>
        <Link href={config.logo.href} className={styles.logo}>
          <Logo className={styles.logoSvg} />
          {config.logo.text}
          <span>{config.logo.subtext}</span>.
        </Link>

        <div className={`${styles.navbarNav} ${activePanel === "navbar" ? styles.active : ""}`}>
          {config.menuItems.map((item, index) => (
            <Link key={index} href={item.href} onClick={() => setActivePanel(null)}>
              {item.label}
            </Link>
          ))}
          
          <div className={styles.mobileAuthSection}>
            {user ? (
              <>
                <span className={styles.mobileUserName}>Halo, {user.displayName || user.email?.split('@')[0] || "User"}</span>
                {authItems.map((item, index) => (
                  item.type === 'link' ? (
                    <Link key={index} href={item.href} className={styles.mobileAuthLink} onClick={() => setActivePanel(null)}>{item.label}</Link>
                  ) : (
                    <button key={index} onClick={() => {logout(); setActivePanel(null);}} className={`${styles.mobileAuthLink} ${styles.mobileLogoutBtn}`}>{item.label}</button>
                  )
                ))}
              </>
            ) : (
              unauthItem && <Link href={unauthItem.href} className={styles.mobileLoginBtn} onClick={() => setActivePanel(null)}>{unauthItem.label}</Link>
            )}
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
          <button onClick={() => togglePanel("search")} aria-label="Cari Produk">
            <svg className={styles.svgIcon}><use href={`/assets/icon/feather-sprite.svg#${config?.features?.search?.icon}`} /></svg>
          </button>

          <button className={styles.cartButton} onClick={() => setIsCartOpen(!isCartOpen)} aria-label={config?.features?.cart?.ariaLabel}>
            <svg className={`${styles.svgIcon} ${animate ? styles.cartBounce : ""}`}><use href={`/assets/icon/feather-sprite.svg#${config?.features?.cart?.icon}`} /></svg>
            {isMounted && cartQuantity > 0 && (
              <span className={styles.quantityBadge}>{cartQuantity}</span>
            )}
          </button>

          <button onClick={toggleTheme} className={styles.themeToggleBtn} aria-label="Toggle Theme">
            <svg className={styles.svgIcon}><use href={`/assets/icon/feather-sprite.svg#${theme === 'dark' ? 'sun' : 'moon'}`} /></svg>
          </button>
          
          <div className={styles.authContainer}>
            {user ? (
              <div className={styles.userMenu} ref={userMenuRef}>
                <button className={styles.userAvatarBtn} onClick={() => setIsUserMenuOpen(prev => !prev)}>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User Avatar" className={styles.avatarImg} />
                  ) : (
                    <svg className={styles.svgIcon}><use href="/assets/icon/feather-sprite.svg#user" /></svg>
                  )}
                </button>
                {isUserMenuOpen && (
                  <div className={styles.userDropdown}>
                    {authItems.map((item, index) => (
                      item.type === 'link' ? (
                        <Link key={index} href={item.href} className={styles.dropdownItem}>{item.label}</Link>
                      ) : (
                        <button key={index} onClick={logout} className={`${styles.dropdownItem} ${styles.logoutBtn}`}>{item.label}</button>
                      )
                    ))}
                  </div>
                )}
              </div>
            ) : (
              unauthItem && <Link href={unauthItem.href} className={styles.loginBtn}>{unauthItem.label}</Link>
            )}
          </div>

          <button onClick={() => togglePanel("navbar")} className={styles.hamburger} aria-label="Menu Navigasi">
            <svg className={styles.svgIcon}><use href={`/assets/icon/feather-sprite.svg#${activePanel === "navbar" ? config?.features?.hamburger?.iconClose : config?.features?.hamburger?.iconOpen}`} /></svg>
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
