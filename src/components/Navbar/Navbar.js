"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { useTheme } from "@/context/ThemeContext";
import { SearchForm } from "./SearchForm";
import { CartSidebar } from "../UI/Sidebar/CartSidebar";
import { Modal } from "../UI/Modal/ProductModal";
import styles from "./Navbar.module.css";
import config from "@/data/ui/navbarConfig.json";
import { Logo } from "@/components/UI/Logo/logo";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

export function Navbar() {
  const [activePanel, setActivePanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [animate, setAnimate] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeHash, setActiveHash] = useState("");

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

  const { theme, toggleTheme, isThemeReady } = useTheme();
  const pathname = usePathname();

  const authItems = config?.authSection?.auth?.authenticated || [];
  const unauthItem = config?.authSection?.auth?.unauthenticated?.[0];

  const userMenuRef = useRef(null);

  useEffect(() => {
    const shouldLock =
      activePanel === "navbar" || activePanel === "search" || isCartOpen;
    document.body.style.overflow = shouldLock ? "hidden" : "unset";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [activePanel, isCartOpen]);

  useEffect(() => {
    let rafId = null;
    const handleScroll = () => {
      if (rafId) return; // sudah ada frame pending, skip
      rafId = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 50);
        rafId = null;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
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
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (cartQuantity > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
  }, [cartQuantity]);

  // Tutup dropdown/panel yang lagi terbuka pas user pencet Escape
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (isUserMenuOpen) setIsUserMenuOpen(false);
      if (activePanel) setActivePanel(null);
      if (isCartOpen) setIsCartOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isUserMenuOpen, activePanel, isCartOpen, setIsCartOpen]);

  // Lacak hash aktif di URL (buat active link indicator pada anchor menu)
  useEffect(() => {
    const updateHash = () => setActiveHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

// Handler navigasi cerdas untuk Anchor Link / Hash (#)
  const handleNavClick = (e, href) => {
    setActivePanel(null);

    if (href && href.includes("#")) {
      e.preventDefault();

      // Ambil bagian hash-nya saja (contoh: "product" dari "/#product" atau "#product")
      const hashPart = href.split("#")[1];
      const isHome = window.location.pathname === "/";

      if (isHome) {
        // Cari elemen berdasarkan ID section produk Anda
        const targetElement = document.getElementById(hashPart) || document.querySelector(`#${hashPart}`);

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
          // Perbarui URL hash di browser tanpa memuat ulang halaman
          window.history.pushState(null, "", `#${hashPart}`);
          setActiveHash(`#${hashPart}`);
        } else {
          // Fallback jika elemen belum terpanggil
          window.location.hash = hashPart;
        }
      } else {
        // Jika sedang berada di halaman lain, arahkan kembali ke beranda beserta hash-nya
        window.location.href = `/#${hashPart}`;
      }
    }
  };

  // Cek apakah sebuah menu item sedang "aktif" (match pathname penuh, atau match hash)
  const isLinkActive = (href) => {
    if (!href) return false;
    if (href.includes("#")) {
      const hashPart = href.split("#")[1];
      return activeHash === `#${hashPart}`;
    }
    return pathname === href;
  };

  const productList = Array.isArray(products) ? products : products?.data || [];

  // Cuma dihitung ulang kalau produk/queries berubah, dan cuma kalau panel search
  // sedang aktif — hindari filter jalan sia-sia tiap render (scroll, toggle theme, dll).
  const filtered = useMemo(() => {
    if (activePanel !== "search") return [];
    return productList.filter((p) =>
      p?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [productList, searchQuery, activePanel]);

  const togglePanel = (panelName) => {
    setActivePanel((prev) => (prev === panelName ? null : panelName));
    setIsCartOpen(false); // pastikan cart nggak numpuk sama panel lain
  };

  const handleToggleCart = () => {
    setIsCartOpen((prev) => !prev);
    setActivePanel(null); // pastikan panel lain nggak numpuk sama cart
  };

  const userAvatar = user?.photoURL || user?.photo_url;
  const userName =
    user?.full_name ||
    user?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <>
      <nav className={`${styles.navbar} ${isScrolled ? styles.scrolled : ""}`}>
        <Link href={config.logo.href} className={styles.logo}>
          <Logo className={styles.logoSvg} />
          {config.logo.text}
          <span>{config.logo.subtext}</span>.
        </Link>

        <div
          className={`${styles.navbarNav} ${activePanel === "navbar" ? styles.active : ""}`}
        >
          {config.menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className={isLinkActive(item.href) ? styles.navLinkActive : ""}
              aria-current={isLinkActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}

          <div className={styles.mobileAuthSection}>
            {user ? (
              <>
                <div className={styles.mobileUserInfo}>
                  {userAvatar && !imageError ? (
                    <img
                      src={userAvatar}
                      alt="User Avatar"
                      className={styles.avatarImgMobile}
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholderMobile}>
                      <AppIcon name="user" className={styles.svgIcon} />
                    </div>
                  )}
                  <span className={styles.mobileUserName}>{userName}</span>
                </div>
                {authItems.map((item, index) =>
                  item.type === "link" ? (
                    <Link
                      key={index}
                      href={item.href}
                      className={styles.mobileAuthLink}
                      onClick={() => setActivePanel(null)}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      key={index}
                      onClick={() => {
                        logout();
                        setActivePanel(null);
                      }}
                      className={`${styles.mobileAuthLink} ${styles.mobileLogoutBtn}`}
                    >
                      {item.label}
                    </button>
                  ),
                )}
              </>
            ) : (
              unauthItem && (
                <Link
                  href={unauthItem.href}
                  className={styles.mobileLoginBtn}
                  onClick={() => setActivePanel(null)}
                >
                  {unauthItem.label}
                </Link>
              )
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
          <button
            onClick={() => togglePanel("search")}
            aria-label="Cari Produk"
          >
            <AppIcon name={config?.features?.search?.icon} className={styles.svgIcon} />
          </button>

          <button
            className={styles.cartButton}
            onClick={handleToggleCart}
            aria-label={config?.features?.cart?.ariaLabel}
          >
            <AppIcon
              name={config?.features?.cart?.icon}
              className={`${styles.svgIcon} ${animate ? styles.cartBounce : ""}`}
            />
            {isClient && cartQuantity > 0 && (
              <span
                className={`${styles.quantityBadge} ${animate ? styles.quantityPulse : ""}`}
              >
                {cartQuantity}
                {animate && (
                  <span className={styles.pulseRing} aria-hidden="true" />
                )}
              </span>
            )}
          </button>

          <button
            onClick={toggleTheme}
            className={styles.themeToggleBtn}
            aria-label="Toggle Theme"
          >
            {/* Tunggu isThemeReady (dari ThemeContext) sebelum tampilkan icon
                yang sesuai tema asli user — sebelum itu, theme masih default
                'dark' yang sama persis dengan yang dirender server. */}
            <AppIcon
              name={!isThemeReady ? "sun" : theme === "dark" ? "sun" : "moon"}
              className={styles.svgIcon}
            />
          </button>

          <div className={styles.authContainer}>
            {user ? (
              <div className={styles.userMenu} ref={userMenuRef}>
                <button
                  className={styles.userAvatarBtn}
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  aria-label="Menu Pengguna"
                >
                  {userAvatar && !imageError ? (
                    <img
                      src={userAvatar}
                      alt="User Avatar"
                      className={styles.avatarImg}
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <AppIcon name="user" className={styles.svgIcon} />
                  )}
                </button>
                {isUserMenuOpen && (
                  <div className={styles.userDropdown}>
                    <div className={styles.dropdownHeader}>
                      <span
                        className={styles.dropdownUserName}
                        style={{
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "2px",
                        }}
                      >
                        {userName}
                      </span>
                      <span
                        className={styles.dropdownUserEmail}
                        style={{ fontSize: "0.8rem", opacity: 0.8 }}
                      >
                        {user.email}
                      </span>
                    </div>
                    {authItems.map((item, index) =>
                      item.type === "link" ? (
                        <Link
                          key={index}
                          href={item.href}
                          className={styles.dropdownItem}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <button
                          key={index}
                          onClick={() => {
                            logout();
                            setIsUserMenuOpen(false);
                          }}
                          className={`${styles.dropdownItem} ${styles.logoutBtn}`}
                        >
                          {item.label}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            ) : (
              unauthItem && (
                <Link href={unauthItem.href} className={styles.loginBtn}>
                  {unauthItem.label}
                </Link>
              )
            )}
          </div>

          <button
            onClick={() => togglePanel("navbar")}
            className={styles.hamburger}
            aria-label="Menu Navigasi"
          >
            <AppIcon
              name={activePanel === "navbar" ? config?.features?.hamburger?.iconClose : config?.features?.hamburger?.iconOpen}
              className={styles.svgIcon}
            />
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