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
    document.body.style.overflow =
      activePanel === "navbar" ? "hidden" : "unset";

    return () => {
      document.body.style.overflow = "unset";
    };
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

  const isMounted = typeof window !== "undefined";

  useEffect(() => {
    if (cartQuantity > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 400);
      return () => clearTimeout(timer);
    }
  }, [cartQuantity]);

  const productList = Array.isArray(products) ? products : products?.data || [];
  const filtered = productList.filter((p) =>
    p?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const togglePanel = (panelName) => {
    setActivePanel(activePanel === panelName ? null : panelName);
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
              onClick={() => setActivePanel(null)}
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
            onClick={() => setIsCartOpen(!isCartOpen)}
            aria-label={config?.features?.cart?.ariaLabel}
          >
            <AppIcon
              name={config?.features?.cart?.icon}
              className={`${styles.svgIcon} ${animate ? styles.cartBounce : ""}`}
            />
            {isMounted && cartQuantity > 0 && (
              <span className={styles.quantityBadge}>{cartQuantity}</span>
            )}
          </button>

          <button
            onClick={toggleTheme}
            className={styles.themeToggleBtn}
            aria-label="Toggle Theme"
          >
            <AppIcon
              name={theme === "dark" ? "sun" : "moon"}
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
