"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import styles from "./SettingsView.module.css";
import { auth } from "@/lib/supabaseClient";
import settingsConfig from "@/data/ui/settingsConfig.json";
import { shouldSkipAuthEvent, logoutUser } from "@/utils/authHelpers";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import {
  getAdminSettings,
  saveSettings,
} from "@/services/settingsService";
import UserManagement from "./UserManagement";

const EMPTY = {
  store: {
    storeName: "",
    storeEmail: "",
    currency: "IDR",
    adminLocale: "id",
    lowStockThreshold: 10,
    storeCityId: "",
    storeCityName: "",
    enableMidtrans: true,
    enableManualTransfer: false,
    midtransIsProduction: false,
  },
  couriers: {
    activeCouriers: ["jne", "jnt", "sicepat", "anteraja"],
    biteshipIsProduction: false,
  },
  hero: {
    image: "",
    imageAlt: "",
    imagePublicId: "",
    tagline: "",
    title: { main: "", highlight: "" },
    description: { prefix: "", italic: "", suffix: "" },
    buttons: {
      primary: { label: "", href: "" },
      secondary: { label: "", href: "" },
    },
  },
  about: {
    image: "",
    imageAlt: "",
    imagePublicId: "",
    content: { tagline: "", heading: "", leadText: "", bodyText: "" },
    features: [{ number: "01", title: "", desc: "" }],
  },
  product: {
    header: { tagline: "", title: { main: "", highlight: "" } },
  },
  contact: {
    whatsappNumber: "",
    header: { tagline: "", title: { main: "", highlight: "" } },
    infoItems: [{ icon: "mail", title: "", value: "" }],
    headquarters: { title: "", address: [""], coordinates: "" },
    form: {
      title: "",
      fields: { name: "", email: "", phone: "", message: "" },
      submitText: "",
    },
  },
  footer: {
    branding: {
      logo: { text: "", subtext: "", href: "" },
      description: "",
      socials: [{ href: "", icon: "", label: "" }],
    },
    navigation: { title: "", links: [{ label: "", href: "" }] },
    payment: { title: "", subtitle: "", methods: [""] },
    copyright: { text: "" },
  },
};

const TAB_KEYS = [
  "store",
  "hero",
  "about",
  "product",
  "contact",
  "footer",
  "payment",
  "couriers",
  "account",
];

export default function SettingsView() {
  const [settings, setSettings] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [activeTab, setActiveTab] = useState("store");
  const lastUserIdRef = useRef(null);
  
  // State untuk file gambar About & Hero
  const [selectedAboutImageFile, setSelectedAboutImageFile] = useState(null);
  const [aboutImagePreviewUrl, setAboutImagePreviewUrl] = useState("");

  const [selectedHeroImageFile, setSelectedHeroImageFile] = useState(null);
  const [heroImagePreviewUrl, setHeroImagePreviewUrl] = useState("");

  const [currentSession, setCurrentSession] = useState(null);

  const cfg = settingsConfig;

  // Map dari settings DB ke state lokal bertab
  const mapSettingsToState = (data) => ({
    store: {
      storeName: data?.storeName || "",
      storeEmail: data?.storeEmail || "",
      currency: data?.currency || "IDR",
      adminLocale: data?.adminLocale || "id",
      lowStockThreshold: Number(data?.lowStockThreshold ?? 10),
      storeCityId: data?.storeCityId || "",
      storeCityName: data?.storeCityName || "",
      enableMidtrans: data?.enableMidtrans ?? true,
      enableManualTransfer: data?.enableManualTransfer ?? false,
      midtransIsProduction: data?.midtransIsProduction ?? false,
    },
    couriers: {
      activeCouriers: data?.activeCouriers || ["jne", "jnt", "sicepat", "anteraja"],
      biteshipIsProduction: data?.biteshipIsProduction ?? false,
      biteshipAutoOrder: data?.biteshipAutoOrder ?? false,
    },
    hero: {
      image: data?.hero?.image || "",
      imageAlt: data?.hero?.imageAlt || "",
      imagePublicId: data?.hero?.imagePublicId || "",
      tagline: data?.hero?.tagline || "",
      title: {
        main: data?.hero?.title?.main || "",
        highlight: data?.hero?.title?.highlight || "",
      },
      description: {
        prefix: data?.hero?.description?.prefix || "",
        italic: data?.hero?.description?.italic || "",
        suffix: data?.hero?.description?.suffix || "",
      },
      buttons: {
        primary: {
          label: data?.hero?.buttons?.primary?.label || "",
          href: data?.hero?.buttons?.primary?.href || "",
        },
        secondary: {
          label: data?.hero?.buttons?.secondary?.label || "",
          href: data?.hero?.buttons?.secondary?.href || "",
        },
      },
    },
    about: {
      image: data?.about?.image || "",
      imageAlt: data?.about?.imageAlt || "",
      imagePublicId: data?.about?.imagePublicId || "",
      content: {
        tagline: data?.about?.content?.tagline || "",
        heading: data?.about?.content?.heading || "",
        leadText: data?.about?.content?.leadText || "",
        bodyText: data?.about?.content?.bodyText || "",
      },
      features: data?.about?.features || [{ number: "01", title: "", desc: "" }],
    },
    product: {
      header: {
        tagline: data?.product?.header?.tagline || "",
        title: {
          main: data?.product?.header?.title?.main || "",
          highlight: data?.product?.header?.title?.highlight || "",
        },
      },
    },
    contact: {
      whatsappNumber: data?.contact?.whatsappNumber || "",
      header: {
        tagline: data?.contact?.header?.tagline || "",
        title: {
          main: data?.contact?.header?.title?.main || "",
          highlight: data?.contact?.header?.title?.highlight || "",
        },
      },
      infoItems: data?.contact?.infoItems || [
        { icon: "mail", title: "", value: "" },
      ],
      headquarters: {
        title: data?.contact?.headquarters?.title || "",
        address: data?.contact?.headquarters?.address || [""],
        coordinates: data?.contact?.headquarters?.coordinates || "",
      },
      form: {
        title: data?.contact?.form?.title || "",
        fields: {
          name: data?.contact?.form?.fields?.name || "",
          email: data?.contact?.form?.fields?.email || "",
          phone: data?.contact?.form?.fields?.phone || "",
          message: data?.contact?.form?.fields?.message || "",
        },
        submitText: data?.contact?.form?.submitText || "",
      },
      bankAccounts: data?.contact?.bankAccounts || [],
    },
    footer: {
      branding: {
        logo: {
          text: data?.footer?.branding?.logo?.text || "",
          subtext: data?.footer?.branding?.logo?.subtext || "",
          href: data?.footer?.branding?.logo?.href || "",
        },
        description: data?.footer?.branding?.description || "",
        socials: data?.footer?.branding?.socials || [
          { href: "", icon: "", label: "" },
        ],
      },
      navigation: {
        title: data?.footer?.navigation?.title || "",
        links: data?.footer?.navigation?.links || [{ label: "", href: "" }],
      },
      payment: {
        title: data?.footer?.payment?.title || "",
        subtitle: data?.footer?.payment?.subtitle || "",
        methods: data?.footer?.payment?.methods || [""],
      },
      copyright: { text: data?.footer?.copyright?.text || "" },
    },
  });

  useEffect(() => {
    let subscription = null;

    const initAuthAndFetch = async () => {
      try {
        const { data: { session } } = await auth.getSession();
        lastUserIdRef.current = session?.user?.id || null;
        setCurrentSession(session);

        if (!session) {
          toast.error(cfg.toast?.authRequired || "Authentication required.");
          setIsFetching(false);
          return;
        }

        const data = await getAdminSettings(session);
        setSettings(mapSettingsToState(data));
        setAboutImagePreviewUrl(data?.about?.image || "");
        setHeroImagePreviewUrl(data?.hero?.image || "");

        if (typeof window !== "undefined" && data?.adminLocale) {
          const nextLocale = data.adminLocale === "en" ? "en" : "id";
          window.localStorage.setItem("adminLocale", nextLocale);
          window.dispatchEvent(
            new CustomEvent("admin-locale-change", {
              detail: { locale: nextLocale },
            }),
          );
        }
      } catch (error) {
        console.error("Fetch Settings Error:", error.message);
        toast.error(error.message);
      } finally {
        setIsFetching(false);
      }

      // Listener perubahan sesi Supabase
      const { data: authListener } = auth.onAuthStateChange(async (_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;
        
        setCurrentSession(session);
        if (session) {
          try {
            const data = await getAdminSettings(session);
            setSettings(mapSettingsToState(data));
            setAboutImagePreviewUrl(data?.about?.image || "");
            setHeroImagePreviewUrl(data?.hero?.image || "");
          } catch (error) {
            console.error("Auth Change Fetch Error:", error.message);
          }
        }
      });
      subscription = authListener?.subscription;
    };

    initAuthAndFetch();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(cfg.buttons?.saving || "Menyimpan...");
    setLoading(true);

    if (!currentSession) {
      toast.error(cfg.toast?.sessionExpired || "Sesi berakhir.", {
        id: toastId,
      });
      setLoading(false);
      return;
    }

    try {
      const payload = buildPayload();
      const user = currentSession.user;

      // 1. Unggah gambar Hero jika ada file baru
      if (selectedHeroImageFile) {
        setUploadingImage(true);
        const heroFormData = new FormData();
        heroFormData.append("file", selectedHeroImageFile);
        heroFormData.append("userId", user.id);
        heroFormData.append("folder", "storefront");
        heroFormData.append("publicId", `storefront/hero-${user.id}`);
        heroFormData.append("oldPublicId", settings.hero.imagePublicId || "");
        heroFormData.append("oldUrl", settings.hero.image || "");

        const heroUploadRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: heroFormData,
        });
        const heroUploadResult = (heroUploadRes.headers?.get("content-type")?.includes("application/json") ? await heroUploadRes.json() : {});

        if (!heroUploadRes.ok) {
          throw new Error(heroUploadResult.error || "Gagal mengunggah gambar Hero.");
        }

        payload.hero.image = heroUploadResult.secure_url;
        payload.hero.imagePublicId = heroUploadResult.public_id;
        setHeroImagePreviewUrl(heroUploadResult.secure_url);
        setSelectedHeroImageFile(null);
      }

      // 2. Unggah gambar About jika ada file baru
      if (selectedAboutImageFile) {
        setUploadingImage(true);
        const aboutFormData = new FormData();
        aboutFormData.append("file", selectedAboutImageFile);
        aboutFormData.append("userId", user.id);
        aboutFormData.append("folder", "storefront");
        aboutFormData.append("publicId", `storefront/about-${user.id}`);
        aboutFormData.append("oldPublicId", settings.about.imagePublicId || "");
        aboutFormData.append("oldUrl", settings.about.image || "");

        const aboutUploadRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: aboutFormData,
        });
        const aboutUploadResult = (aboutUploadRes.headers?.get("content-type")?.includes("application/json") ? await aboutUploadRes.json() : {});

        if (!aboutUploadRes.ok) {
          throw new Error(aboutUploadResult.error || "Gagal mengunggah gambar About.");
        }

        payload.about.image = aboutUploadResult.secure_url;
        payload.about.imagePublicId = aboutUploadResult.public_id;
        setAboutImagePreviewUrl(aboutUploadResult.secure_url);
        setSelectedAboutImageFile(null);
      }

      setUploadingImage(false);

      await saveSettings(payload, currentSession);

      const fresh = await getAdminSettings(currentSession);
      setSettings(mapSettingsToState(fresh));
      setAboutImagePreviewUrl(fresh?.about?.image || "");
      setHeroImagePreviewUrl(fresh?.hero?.image || "");

      if (typeof window !== "undefined") {
        const nextLocale = fresh?.adminLocale === "en" ? "en" : "id";
        window.localStorage.setItem("adminLocale", nextLocale);
        window.dispatchEvent(
          new CustomEvent("admin-locale-change", {
            detail: { locale: nextLocale },
          }),
        );
      }

      toast.success(cfg.toast?.success || "Pengaturan disimpan!", {
        id: toastId,
      });
    } catch (error) {
      console.error("Save Settings Error:", error.message);
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  // Susun payload dari state bertab
  const buildPayload = () => {
    const s = settings;
    const strictValue = (val) => (val === undefined ? "" : val);
    return {
      storeName: strictValue(s.store.storeName),
      storeEmail: strictValue(s.store.storeEmail),
      currency: s.store.currency,
      adminLocale: s.store.adminLocale === "en" ? "en" : "id",
      lowStockThreshold: Number(s.store.lowStockThreshold) || 10,
      storeCityId: strictValue(s.store.storeCityId),
      storeCityName: strictValue(s.store.storeCityName),
      enableMidtrans: Boolean(s.store.enableMidtrans),
      enableManualTransfer: Boolean(s.store.enableManualTransfer),
      midtransIsProduction: Boolean(s.store.midtransIsProduction),
      activeCouriers: s.couriers.activeCouriers || ["jne", "jnt", "sicepat"],
      biteshipIsProduction: Boolean(s.couriers.biteshipIsProduction),
      biteshipAutoOrder: Boolean(s.couriers.biteshipAutoOrder),
      hero: {
        image: strictValue(s.hero.image),
        imageAlt: strictValue(s.hero.imageAlt),
        imagePublicId: strictValue(s.hero.imagePublicId),
        tagline: strictValue(s.hero.tagline),
        title: {
          main: strictValue(s.hero.title?.main),
          highlight: strictValue(s.hero.title?.highlight),
        },
        description: {
          prefix: strictValue(s.hero.description?.prefix),
          italic: strictValue(s.hero.description?.italic),
          suffix: strictValue(s.hero.description?.suffix),
        },
        buttons: {
          primary: {
            label: strictValue(s.hero.buttons?.primary?.label),
            href: strictValue(s.hero.buttons?.primary?.href),
          },
          secondary: {
            label: strictValue(s.hero.buttons?.secondary?.label),
            href: strictValue(s.hero.buttons?.secondary?.href),
          },
        },
      },
      about: {
        image: strictValue(s.about.image),
        imageAlt: strictValue(s.about.imageAlt),
        imagePublicId: strictValue(s.about.imagePublicId),
        content: {
          tagline: strictValue(s.about.content?.tagline),
          heading: strictValue(s.about.content?.heading),
          leadText: strictValue(s.about.content?.leadText),
          bodyText: strictValue(s.about.content?.bodyText),
        },
        features: s.about.features || [],
      },
      product: {
        header: {
          tagline: strictValue(s.product?.header?.tagline),
          title: {
            main: strictValue(s.product?.header?.title?.main),
            highlight: strictValue(s.product?.header?.title?.highlight),
          },
        },
      },
      contact: {
        whatsappNumber: strictValue(s.contact.whatsappNumber),
        header: {
          tagline: strictValue(s.contact.header?.tagline),
          title: {
            main: strictValue(s.contact.header?.title?.main),
            highlight: strictValue(s.contact.header?.title?.highlight),
          },
        },
        infoItems: s.contact.infoItems || [],
        headquarters: {
          title: strictValue(s.contact.headquarters?.title),
          address: s.contact.headquarters?.address || [],
          coordinates: strictValue(s.contact.headquarters?.coordinates),
        },
        form: {
          title: strictValue(s.contact.form?.title),
          fields: {
            name: strictValue(s.contact.form?.fields?.name),
            email: strictValue(s.contact.form?.fields?.email),
            phone: strictValue(s.contact.form?.fields?.phone),
            message: strictValue(s.contact.form?.fields?.message),
          },
          submitText: strictValue(s.contact.form?.submitText),
        },
        bankAccounts: s.contact.bankAccounts || [],
      },
      footer: {
        branding: {
          logo: {
            text: strictValue(s.footer.branding?.logo?.text),
            subtext: strictValue(s.footer.branding?.logo?.subtext),
            href: strictValue(s.footer.branding?.logo?.href),
          },
          description: strictValue(s.footer.branding?.description),
          socials: s.footer.branding?.socials || [],
        },
        navigation: {
          title: strictValue(s.footer.navigation?.title),
          links: s.footer.navigation?.links || [],
        },
        payment: {
          title: strictValue(s.footer.payment?.title),
          subtitle: strictValue(s.footer.payment?.subtitle),
          methods: s.footer.payment?.methods || [],
        },
        copyright: { text: strictValue(s.footer.copyright?.text) },
      },
    };
  };

  const updateTab = (tab, patch) => {
    setSettings((prev) => ({ ...prev, [tab]: patch }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      store: {
        ...prev.store,
        [name]: type === "checkbox" ? checked : value,
      },
    }));
  };

  const handleHeroImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedHeroImageFile(file);
    setHeroImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleAboutImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedAboutImageFile(file);
    setAboutImagePreviewUrl(URL.createObjectURL(file));
  };

  if (isFetching) {
    return <p className={styles.loadingText}>{cfg.loading || "Memuat..."}</p>;
  }

  return (
    <div className={styles.settingsContainer}>
      <h3 className={styles.settingsTitle}>{cfg.title}</h3>

      {/* Tab navigasi */}
      <div className={styles.tabNav}>
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.tabBtn} ${
              activeTab === key ? styles.tabBtnActive : ""
            }`}
            onClick={() => setActiveTab(key)}
          >
            {cfg.tabs?.[key] || key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            toast.loading("Keluar dari panel admin...", { id: "admin-logout" });
            logoutUser();
          }}
          className={styles.logoutTabBtn}
          aria-label="Keluar dari akun admin"
          title="Keluar dari akun admin"
        >
          <AppIcon name="log-out" size={14} />
          <span>Keluar Akun</span>
        </button>
      </div>

      <form onSubmit={handleSave}>
        {activeTab === "store" && (
          <StoreTab
            settings={settings.store}
            handleInputChange={handleInputChange}
            cfg={cfg}
          />
        )}

        {activeTab === "hero" && (
          <HeroTab
            settings={settings.hero}
            updateTab={updateTab}
            handleHeroImageSelect={handleHeroImageSelect}
            heroImagePreviewUrl={heroImagePreviewUrl}
            cfg={cfg}
          />
        )}

        {activeTab === "about" && (
          <AboutTab
            settings={settings.about}
            updateTab={updateTab}
            handleAboutImageSelect={handleAboutImageSelect}
            aboutImagePreviewUrl={aboutImagePreviewUrl}
            cfg={cfg}
          />
        )}

        {activeTab === "product" && (
          <ProductTab
            settings={settings.product}
            updateTab={updateTab}
            cfg={cfg}
          />
        )}

        {activeTab === "contact" && (
          <ContactTab
            settings={settings.contact}
            updateTab={updateTab}
            cfg={cfg}
          />
        )}

        {activeTab === "footer" && (
          <FooterTab
            settings={settings.footer}
            updateTab={updateTab}
            cfg={cfg}
          />
        )}

        {activeTab === "payment" && (
          <PaymentTab
            settings={settings.store}
            handleInputChange={handleInputChange}
            bankAccounts={settings.contact?.bankAccounts || []}
            updateBankAccounts={(accounts) => updateTab("contact", { ...settings.contact, bankAccounts: accounts })}
            cfg={cfg}
          />
        )}

        {activeTab === "couriers" && (
          <CouriersTab
            settings={settings.couriers}
            updateCouriers={(newCouriers) =>
              setSettings((prev) => ({
                ...prev,
                couriers: { ...prev.couriers, activeCouriers: newCouriers },
              }))
            }
            updateBiteshipMode={(isProduction) =>
              setSettings((prev) => ({
                ...prev,
                couriers: { ...prev.couriers, biteshipIsProduction: isProduction },
              }))
            }
            updateBiteshipAutoOrder={(autoOrder) =>
              setSettings((prev) => ({
                ...prev,
                couriers: { ...prev.couriers, biteshipAutoOrder: autoOrder },
              }))
            }
          />
        )}

        {activeTab === "account" && (
          <div className={styles.tabContent}>
            <div style={{ marginBottom: "2rem" }}>
              <h4 className={styles.sectionTitle}>Manajemen Akun</h4>
              <p className={styles.helpText}>
                Anda dapat mengelola pengguna admin di bagian bawah.
              </p>
            </div>
            
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "2rem" }}>
              <UserManagement />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || uploadingImage || activeTab === "account"}
          className={styles.saveBtn}
        >
          {loading || uploadingImage
            ? cfg.buttons?.saving || "Menyimpan..."
            : cfg.buttons?.save || "Simpan Perubahan"}
        </button>
      </form>
    </div>
  );
}

/* ============================================================
   TAB: STORE
   ============================================================ */
function StoreTab({ settings, handleInputChange, cfg }) {
  const [areaSearch, setAreaSearch] = useState("");
  const [areaOptions, setAreaOptions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);

  const handleAreaSearch = (e) => {
    const val = e.target.value;
    setAreaSearch(val);
    setShowDropdown(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.length < 3) {
      setAreaOptions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/biteship/areas?q=${encodeURIComponent(val)}`);
        const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        setAreaOptions(data.areas || []);
      } catch (err) {
        console.error("Area search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectArea = (area) => {
    const displayName = [area.name, area.administrative_division_level_2, area.administrative_division_level_1]
      .filter(Boolean)
      .join(", ");
    handleInputChange({ target: { name: "storeCityName", value: displayName } });
    handleInputChange({ target: { name: "storeCityId", value: area.id } });
    setAreaSearch("");
    setShowDropdown(false);
  };

  return (
    <>
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.sections?.storeInfo || "Informasi Toko"}
        </h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.labels?.storeName || "Nama Toko"}
          </label>
          <input
            type="text"
            name="storeName"
            value={settings.storeName}
            onChange={handleInputChange}
            className={styles.inputField}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.labels?.storeEmail || "Email Kontak"}
          </label>
          <input
            type="email"
            name="storeEmail"
            value={settings.storeEmail}
            onChange={handleInputChange}
            className={styles.inputField}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.labels?.currency || "Mata Uang"}
          </label>
          <select
            name="currency"
            value={settings.currency}
            onChange={handleInputChange}
            className={styles.selectField}
          >
            <option value="IDR">IDR (Indonesian Rupiah)</option>
            <option value="USD">USD (US Dollar)</option>
          </select>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.labels?.adminLocale || "Bahasa Dashboard Admin"}
          </label>
          <select
            name="adminLocale"
            value={settings.adminLocale || "id"}
            onChange={handleInputChange}
            className={styles.selectField}
          >
            <option value="id">
              {cfg.options?.adminLocaleId || "Indonesia (ID)"}
            </option>
            <option value="en">
              {cfg.options?.adminLocaleEn || "English (EN)"}
            </option>
          </select>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.labels?.lowStockThreshold || "Batas Stok Menipis"}
          </label>
          <input
            type="number"
            name="lowStockThreshold"
            value={settings.lowStockThreshold}
            onChange={handleInputChange}
            className={styles.inputField}
            min="0"
            required
          />
        </div>
        <div className={styles.inputGroup} style={{ position: "relative" }}>
          <label className={styles.fieldLabel}>
            Kota / Wilayah Toko (Asal Pengiriman Biteship)
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              name="storeCityName"
              value={settings.storeCityName || ""}
              readOnly
              className={styles.inputField}
              style={{ backgroundColor: "var(--surface-secondary)", cursor: "not-allowed", flex: 1 }}
              placeholder="Pilih wilayah melalui kolom pencarian di sebelah"
            />
            <button 
              type="button" 
              onClick={() => handleInputChange({ target: { name: "storeCityName", value: "" } })}
              style={{ padding: "0 12px", background: "transparent", border: "1px solid var(--border-color)", borderRadius: "6px", cursor: "pointer", color: "var(--text-secondary)" }}
            >
              Reset
            </button>
          </div>
          
          <div style={{ marginTop: "12px", position: "relative" }}>
            <input
              type="text"
              value={areaSearch}
              onChange={handleAreaSearch}
              onFocus={() => {
                if (areaSearch.length >= 3) setShowDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className={styles.inputField}
              placeholder="Ketik minimal 3 huruf nama kota/kecamatan asal (Cth: Sleman)..."
            />
            {isSearching && (
              <span style={{ position: "absolute", right: "12px", top: "10px", fontSize: "12px", color: "var(--text-secondary)" }}>
                Mencari...
              </span>
            )}
            {showDropdown && areaOptions.length > 0 && (
              <ul style={{
                position: "absolute", top: "100%", left: 0, right: 0, 
                background: "var(--surface-primary)", border: "1px solid var(--border-color)", 
                borderRadius: "6px", maxHeight: "200px", overflowY: "auto", 
                zIndex: 50, padding: 0, margin: "4px 0 0 0", listStyle: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}>
                {areaOptions.map((opt) => (
                  <li 
                    key={opt.id} 
                    onClick={() => handleSelectArea(opt)}
                    style={{ padding: "10px 12px", cursor: "pointer", fontSize: "14px", borderBottom: "1px solid var(--border-color)" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--surface-secondary)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <strong>{opt.name}</strong>
                    {opt.administrative_division_level_2 ? `, ${opt.administrative_division_level_2}` : ''}
                    {opt.administrative_division_level_1 ? `, ${opt.administrative_division_level_1}` : ''}
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Kode Pos: {opt.postal_code || "-"}</div>
                  </li>
                ))}
              </ul>
            )}
            {showDropdown && areaSearch.length >= 3 && areaOptions.length === 0 && !isSearching && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, 
                background: "var(--surface-primary)", border: "1px solid var(--border-color)", 
                borderRadius: "6px", padding: "12px", zIndex: 50, margin: "4px 0 0 0",
                fontSize: "14px", color: "var(--text-secondary)", textAlign: "center"
              }}>
                Wilayah tidak ditemukan.
              </div>
            )}
          </div>
          <small className={styles.fieldDesc} style={{ display: "block", marginTop: "0.4rem" }}>
            Data wilayah ini tersinkronisasi otomatis dengan Biteship (Area ID: {settings.storeCityId || "Belum dipilih"}).
          </small>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   TAB: HERO
   ============================================================ */
function HeroTab({ settings, updateTab, handleHeroImageSelect, heroImagePreviewUrl, cfg }) {
  const s = settings;
  const set = (patch) => updateTab("hero", { ...s, ...patch });

  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.sections?.hero || "Hero Section"}
      </h4>

      {/* Bagian Upload Gambar Hero */}
      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Hero Gambar URL</label>
          <input
            className={styles.inputField}
            value={s.image}
            onChange={(e) => set({ image: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Alt Gambar Hero</label>
          <input
            className={styles.inputField}
            value={s.imageAlt}
            onChange={(e) => set({ imageAlt: e.target.value })}
            placeholder="Deskripsi gambar..."
          />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>
          Unggah File Gambar Hero
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleHeroImageSelect}
          className={styles.fileInput}
        />
        <small className={styles.fieldDesc}>
          Unggah gambar atau ilustrasi utama untuk Hero Section landing page.
        </small>
      </div>

      {(heroImagePreviewUrl || s.image) && (
        <div className={styles.previewCard}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic blob & Cloudinary preview URLs require a plain <img>. */}
          <img
            src={heroImagePreviewUrl || s.image}
            alt={s.imageAlt || "Hero Preview"}
            className={styles.previewImage}
          />
        </div>
      )}

      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>Tagline</label>
        <input
          className={styles.inputField}
          value={s.tagline}
          onChange={(e) => set({ tagline: e.target.value })}
        />
      </div>
      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Judul Utama</label>
          <input
            className={styles.inputField}
            value={s.title?.main}
            onChange={(e) =>
              set({ title: { ...s.title, main: e.target.value } })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Judul Sorotan</label>
          <input
            className={styles.inputField}
            value={s.title?.highlight}
            onChange={(e) =>
              set({ title: { ...s.title, highlight: e.target.value } })
            }
          />
        </div>
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>Deskripsi Awal</label>
        <input
          className={styles.inputField}
          value={s.description?.prefix}
          onChange={(e) =>
            set({ description: { ...s.description, prefix: e.target.value } })
          }
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>Kata Miring</label>
        <input
          className={styles.inputField}
          value={s.description?.italic}
          onChange={(e) =>
            set({ description: { ...s.description, italic: e.target.value } })
          }
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>Deskripsi Akhir</label>
        <input
          className={styles.inputField}
          value={s.description?.suffix}
          onChange={(e) =>
            set({ description: { ...s.description, suffix: e.target.value } })
          }
        />
      </div>
      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Tombol Utama Label</label>
          <input
            className={styles.inputField}
            value={s.buttons?.primary?.label}
            onChange={(e) =>
              set({
                buttons: {
                  ...s.buttons,
                  primary: { ...s.buttons?.primary, label: e.target.value },
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Tombol Utama Href</label>
          <input
            className={styles.inputField}
            value={s.buttons?.primary?.href}
            onChange={(e) =>
              set({
                buttons: {
                  ...s.buttons,
                  primary: { ...s.buttons?.primary, href: e.target.value },
                },
              })
            }
          />
        </div>
      </div>
      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Tombol Kedua Label</label>
          <input
            className={styles.inputField}
            value={s.buttons?.secondary?.label}
            onChange={(e) =>
              set({
                buttons: {
                  ...s.buttons,
                  secondary: { ...s.buttons?.secondary, label: e.target.value },
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Tombol Kedua Href</label>
          <input
            className={styles.inputField}
            value={s.buttons?.secondary?.href}
            onChange={(e) =>
              set({
                buttons: {
                  ...s.buttons,
                  secondary: { ...s.buttons?.secondary, href: e.target.value },
                },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: ABOUT
   ============================================================ */
function AboutTab({ settings, updateTab, handleAboutImageSelect, aboutImagePreviewUrl, cfg }) {
  const s = settings;
  const set = (patch) => updateTab("about", { ...s, ...patch });

  return (
    <>
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.sections?.about || "About Section"}
        </h4>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Gambar URL</label>
            <input
              className={styles.inputField}
              value={s.image}
              onChange={(e) => set({ image: e.target.value })}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Alt Gambar</label>
            <input
              className={styles.inputField}
              value={s.imageAlt}
              onChange={(e) => set({ imageAlt: e.target.value })}
            />
          </div>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.labels?.aboutImage || "Gambar Section About"}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleAboutImageSelect}
            className={styles.fileInput}
          />
          <small className={styles.fieldDesc}>
            {cfg.descriptions?.aboutImage ||
              "Unggah gambar untuk bagian About di landing page."}
          </small>
        </div>
        {(aboutImagePreviewUrl || s.image) && (
          <div className={styles.previewCard}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic blob & Cloudinary preview URLs require a plain <img>. */}
            <img
              src={aboutImagePreviewUrl || s.image}
              alt={s.imageAlt || "Preview"}
              className={styles.previewImage}
            />
          </div>
        )}
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Tagline</label>
          <input
            className={styles.inputField}
            value={s.content?.tagline}
            onChange={(e) =>
              set({ content: { ...s.content, tagline: e.target.value } })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Heading</label>
          <input
            className={styles.inputField}
            value={s.content?.heading}
            onChange={(e) =>
              set({ content: { ...s.content, heading: e.target.value } })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Lead Text</label>
          <textarea
            className={styles.textAreaField}
            value={s.content?.leadText}
            rows={2}
            onChange={(e) =>
              set({ content: { ...s.content, leadText: e.target.value } })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Body Text</label>
          <textarea
            className={styles.textAreaField}
            value={s.content?.bodyText}
            rows={3}
            onChange={(e) =>
              set({ content: { ...s.content, bodyText: e.target.value } })
            }
          />
        </div>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>Fitur</h4>
        {s.features?.map((feat, idx) => (
          <div key={idx} className={styles.nestedCard}>
            <div className={styles.row2}>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Nomor</label>
                <input
                  className={styles.inputField}
                  value={feat.number}
                  onChange={(e) =>
                    set({
                      features: s.features.map((f, i) =>
                        i === idx ? { ...f, number: e.target.value } : f,
                      ),
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Judul</label>
                <input
                  className={styles.inputField}
                  value={feat.title}
                  onChange={(e) =>
                    set({
                      features: s.features.map((f, i) =>
                        i === idx ? { ...f, title: e.target.value } : f,
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.fieldLabel}>Deskripsi</label>
              <input
                className={styles.inputField}
                value={feat.desc}
                onChange={(e) =>
                  set({
                    features: s.features.map((f, i) =>
                      i === idx ? { ...f, desc: e.target.value } : f,
                    ),
                  })
                }
              />
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                set({
                  features: s.features.filter((_, i) => i !== idx),
                })
              }
            >
              Hapus fitur
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() =>
            set({
              features: [
                ...s.features,
                {
                  number: String(s.features.length + 1).padStart(2, "0"),
                  title: "",
                  desc: "",
                },
              ],
            })
          }
        >
          + Tambah Fitur
        </button>
      </div>
    </>
  );
}

/* ============================================================
   TAB: CONTACT
   ============================================================ */
function ContactTab({ settings, updateTab, cfg }) {
  const s = settings;
  const set = (patch) => updateTab("contact", { ...s, ...patch });

  return (
    <>
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.sections?.contact || "Contact Section"}
        </h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Nomor WhatsApp</label>
          <input
            className={styles.inputField}
            value={s.whatsappNumber}
            onChange={(e) => set({ whatsappNumber: e.target.value })}
          />
        </div>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Header Tagline</label>
            <input
              className={styles.inputField}
              value={s.header?.tagline}
              onChange={(e) =>
                set({ header: { ...s.header, tagline: e.target.value } })
              }
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Judul Utama</label>
            <input
              className={styles.inputField}
              value={s.header?.title?.main}
              onChange={(e) =>
                set({
                  header: {
                    ...s.header,
                    title: { ...s.header?.title, main: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Judul Sorotan</label>
            <input
              className={styles.inputField}
              value={s.header?.title?.highlight}
              onChange={(e) =>
                set({
                  header: {
                    ...s.header,
                    title: { ...s.header?.title, highlight: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>Info Items</h4>
        {s.infoItems?.map((item, idx) => (
          <div key={idx} className={styles.nestedCard}>
            <div className={styles.row3}>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Icon</label>
                <input
                  className={styles.inputField}
                  value={item.icon}
                  onChange={(e) =>
                    set({
                      infoItems: s.infoItems.map((it, i) =>
                        i === idx ? { ...it, icon: e.target.value } : it,
                      ),
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Judul</label>
                <input
                  className={styles.inputField}
                  value={item.title}
                  onChange={(e) =>
                    set({
                      infoItems: s.infoItems.map((it, i) =>
                        i === idx ? { ...it, title: e.target.value } : it,
                      ),
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Nilai</label>
                <input
                  className={styles.inputField}
                  value={item.value}
                  onChange={(e) =>
                    set({
                      infoItems: s.infoItems.map((it, i) =>
                        i === idx ? { ...it, value: e.target.value } : it,
                      ),
                    })
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                set({ infoItems: s.infoItems.filter((_, i) => i !== idx) })
              }
            >
              Hapus
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() =>
            set({ infoItems: [...s.infoItems, { icon: "mail", title: "", value: "" }] })
          }
        >
          + Tambah Info
        </button>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>Alamat & Form</h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Judul Alamat</label>
          <input
            className={styles.inputField}
            value={s.headquarters?.title}
            onChange={(e) =>
              set({
                headquarters: { ...s.headquarters, title: e.target.value },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Baris Alamat 1</label>
          <input
            className={styles.inputField}
            value={s.headquarters?.address?.[0]}
            onChange={(e) =>
              set({
                headquarters: {
                  ...s.headquarters,
                  address: [e.target.value, s.headquarters?.address?.[1] || ""],
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Baris Alamat 2</label>
          <input
            className={styles.inputField}
            value={s.headquarters?.address?.[1]}
            onChange={(e) =>
              set({
                headquarters: {
                  ...s.headquarters,
                  address: [s.headquarters?.address?.[0] || "", e.target.value],
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Koordinat</label>
          <input
            className={styles.inputField}
            value={s.headquarters?.coordinates}
            onChange={(e) =>
              set({
                headquarters: {
                  ...s.headquarters,
                  coordinates: e.target.value,
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Judul Form</label>
          <input
            className={styles.inputField}
            value={s.form?.title}
            onChange={(e) => set({ form: { ...s.form, title: e.target.value } })}
          />
        </div>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Label Nama</label>
            <input
              className={styles.inputField}
              value={s.form?.fields?.name}
              onChange={(e) =>
                set({
                  form: {
                    ...s.form,
                    fields: { ...s.form?.fields, name: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Label Email</label>
            <input
              className={styles.inputField}
              value={s.form?.fields?.email}
              onChange={(e) =>
                set({
                  form: {
                    ...s.form,
                    fields: { ...s.form?.fields, email: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Label Phone</label>
            <input
              className={styles.inputField}
              value={s.form?.fields?.phone}
              onChange={(e) =>
                set({
                  form: {
                    ...s.form,
                    fields: { ...s.form?.fields, phone: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Label Pesan</label>
            <input
              className={styles.inputField}
              value={s.form?.fields?.message}
              onChange={(e) =>
                set({
                  form: {
                    ...s.form,
                    fields: { ...s.form?.fields, message: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Teks Tombol</label>
          <input
            className={styles.inputField}
            value={s.form?.submitText}
            onChange={(e) =>
              set({ form: { ...s.form, submitText: e.target.value } })
            }
          />
        </div>
      </div>
    </>
  );
}

/* ============================================================
   TAB: FOOTER
   ============================================================ */
function FooterTab({ settings, updateTab, cfg }) {
  const s = settings;
  const set = (patch) => updateTab("footer", { ...s, ...patch });

  return (
    <>
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.sections?.footer || "Footer"}
        </h4>
        <div className={styles.row3}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Logo Teks</label>
            <input
              className={styles.inputField}
              value={s.branding?.logo?.text}
              onChange={(e) =>
                set({
                  branding: {
                    ...s.branding,
                    logo: { ...s.branding?.logo, text: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Logo Subtext</label>
            <input
              className={styles.inputField}
              value={s.branding?.logo?.subtext}
              onChange={(e) =>
                set({
                  branding: {
                    ...s.branding,
                    logo: { ...s.branding?.logo, subtext: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Logo Href</label>
            <input
              className={styles.inputField}
              value={s.branding?.logo?.href}
              onChange={(e) =>
                set({
                  branding: {
                    ...s.branding,
                    logo: { ...s.branding?.logo, href: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Deskripsi Branding</label>
          <textarea
            className={styles.textAreaField}
            value={s.branding?.description}
            rows={2}
            onChange={(e) =>
              set({ branding: { ...s.branding, description: e.target.value } })
            }
          />
        </div>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>Social Links</h4>
        {s.branding?.socials?.map((social, idx) => (
          <div key={idx} className={styles.nestedCard}>
            <div className={styles.row3}>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Icon</label>
                <input
                  className={styles.inputField}
                  value={social.icon}
                  onChange={(e) =>
                    set({
                      branding: {
                        ...s.branding,
                        socials: s.branding.socials.map((so, i) =>
                          i === idx ? { ...so, icon: e.target.value } : so,
                        ),
                      },
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Label</label>
                <input
                  className={styles.inputField}
                  value={social.label}
                  onChange={(e) =>
                    set({
                      branding: {
                        ...s.branding,
                        socials: s.branding.socials.map((so, i) =>
                          i === idx ? { ...so, label: e.target.value } : so,
                        ),
                      },
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Href</label>
                <input
                  className={styles.inputField}
                  value={social.href}
                  onChange={(e) =>
                    set({
                      branding: {
                        ...s.branding,
                        socials: s.branding.socials.map((so, i) =>
                          i === idx ? { ...so, href: e.target.value } : so,
                        ),
                      },
                    })
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                set({
                  branding: {
                    ...s.branding,
                    socials: s.branding.socials.filter((_, i) => i !== idx),
                  },
                })
              }
            >
              Hapus
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() =>
            set({
              branding: {
                ...s.branding,
                socials: [
                  ...(s.branding?.socials || []),
                  { href: "", icon: "", label: "" },
                ],
              },
            })
          }
        >
          + Tambah Social
        </button>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>Navigasi Footer</h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Judul Navigasi</label>
          <input
            className={styles.inputField}
            value={s.navigation?.title}
            onChange={(e) =>
              set({ navigation: { ...s.navigation, title: e.target.value } })
            }
          />
        </div>
        {s.navigation?.links?.map((link, idx) => (
          <div key={idx} className={styles.nestedCard}>
            <div className={styles.row2}>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Label</label>
                <input
                  className={styles.inputField}
                  value={link.label}
                  onChange={(e) =>
                    set({
                      navigation: {
                        ...s.navigation,
                        links: s.navigation.links.map((l, i) =>
                          i === idx ? { ...l, label: e.target.value } : l,
                        ),
                      },
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>Href</label>
                <input
                  className={styles.inputField}
                  value={link.href}
                  onChange={(e) =>
                    set({
                      navigation: {
                        ...s.navigation,
                        links: s.navigation.links.map((l, i) =>
                          i === idx ? { ...l, href: e.target.value } : l,
                        ),
                      },
                    })
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                set({
                  navigation: {
                    ...s.navigation,
                    links: s.navigation.links.filter((_, i) => i !== idx),
                  },
                })
              }
            >
              Hapus link
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() =>
            set({
              navigation: {
                ...s.navigation,
                links: [...(s.navigation?.links || []), { label: "", href: "" }],
              },
            })
          }
        >
          + Tambah Link
        </button>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>Pembayaran & Copyright</h4>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Judul Pembayaran</label>
            <input
              className={styles.inputField}
              value={s.payment?.title}
              onChange={(e) =>
                set({ payment: { ...s.payment, title: e.target.value } })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Subtitle Pembayaran</label>
            <input
              className={styles.inputField}
              value={s.payment?.subtitle}
              onChange={(e) =>
                set({ payment: { ...s.payment, subtitle: e.target.value } })
              }
            />
          </div>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Metode (dipisah koma)</label>
          <input
            className={styles.inputField}
            value={(s.payment?.methods || []).join(", ")}
            onChange={(e) =>
              set({
                payment: {
                  ...s.payment,
                  methods: e.target.value.split(",").map((m) => m.trim()),
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Teks Copyright</label>
          <input
            className={styles.inputField}
            value={s.copyright?.text}
            onChange={(e) =>
              set({ copyright: { ...s.copyright, text: e.target.value } })
            }
          />
        </div>
      </div>
    </>
  );
}

/* ============================================================
   TAB: PAYMENT
   ============================================================ */
function PaymentTab({ settings, handleInputChange, bankAccounts, updateBankAccounts, cfg }) {
  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.sections?.paymentKeys || "Kunci API Gateway Pembayaran"}
      </h4>
      <div className={styles.inputGroup}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.95rem" }}>
          <input
            type="checkbox"
            name="enableMidtrans"
            checked={settings.enableMidtrans ?? true}
            onChange={(e) => {
              const syntheticEvent = {
                target: {
                  name: "enableMidtrans",
                  value: e.target.checked
                }
              };
              handleInputChange(syntheticEvent);
            }}
            style={{ width: "18px", height: "18px" }}
          />
          Aktifkan Midtrans (Pembayaran Otomatis)
        </label>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "0.5rem", marginLeft: "1.7rem" }}>
          Pembayaran otomatis melalui Virtual Account, GoPay, QRIS, dsb. Pastikan Server Key & Client Key sudah diatur di file .env server Anda.
        </p>
      </div>

      {settings.enableMidtrans && (
        <div className={styles.inputGroup} style={{ marginTop: "1rem", marginLeft: "1.7rem", padding: "1rem", background: "var(--surface-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <label className={styles.fieldLabel}>
            Lingkungan Midtrans (Mode)
          </label>
          <select
            name="midtransIsProduction"
            value={settings.midtransIsProduction ? "true" : "false"}
            onChange={(e) => {
              const syntheticEvent = {
                target: {
                  name: "midtransIsProduction",
                  value: e.target.value === "true"
                }
              };
              handleInputChange(syntheticEvent);
            }}
            className={styles.inputField}
            style={{ marginTop: "0.5rem" }}
          >
            <option value="false">Sandbox (Mode Uji Coba)</option>
            <option value="true">Production (Mode Live Asli)</option>
          </select>
          <small className={styles.fieldDesc} style={{ display: "block", marginTop: "0.5rem" }}>
            Pastikan <strong>MIDTRANS_SERVER_KEY_SANDBOX</strong> dan <strong>MIDTRANS_SERVER_KEY_PRODUCTION</strong> sudah diatur di .env!
          </small>
        </div>
      )}

      <div className={styles.inputGroup} style={{ marginTop: "1.5rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.95rem" }}>
          <input
            type="checkbox"
            name="enableManualTransfer"
            checked={settings.enableManualTransfer ?? false}
            onChange={(e) => {
              const syntheticEvent = {
                target: {
                  name: "enableManualTransfer",
                  value: e.target.checked
                }
              };
              handleInputChange(syntheticEvent);
            }}
            style={{ width: "18px", height: "18px" }}
          />
          Aktifkan Transfer Bank Manual
        </label>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "0.5rem", marginLeft: "1.7rem" }}>
          Sistem akan mengirimkan instruksi transfer manual (rekening bank dsb) kepada pelanggan, lalu admin memverifikasi bukti bayar secara manual.
        </p>
      </div>

      {settings.enableManualTransfer && (
        <div className={styles.inputGroup} style={{ marginTop: "1rem", marginLeft: "1.7rem", padding: "1rem", background: "var(--surface-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <h5 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--text-primary)" }}>Daftar Rekening Bank</h5>
          {bankAccounts.map((account, idx) => (
            <div key={account.id || idx} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem", background: "var(--surface-primary)", borderRadius: "6px", marginBottom: "1rem", border: "1px solid var(--border-color)" }}>
              <div className={styles.row2}>
                <div className={styles.inputGroup} style={{ margin: 0 }}>
                  <label className={styles.fieldLabel}>Nama Bank</label>
                  <input
                    className={styles.inputField}
                    value={account.bankName}
                    placeholder="BCA"
                    onChange={(e) => {
                      const newAccs = [...bankAccounts];
                      newAccs[idx].bankName = e.target.value;
                      updateBankAccounts(newAccs);
                    }}
                  />
                </div>
                <div className={styles.inputGroup} style={{ margin: 0 }}>
                  <label className={styles.fieldLabel}>No. Rekening</label>
                  <input
                    className={styles.inputField}
                    value={account.accountNumber}
                    placeholder="1234567890"
                    onChange={(e) => {
                      const newAccs = [...bankAccounts];
                      newAccs[idx].accountNumber = e.target.value;
                      updateBankAccounts(newAccs);
                    }}
                  />
                </div>
              </div>
              <div className={styles.inputGroup} style={{ margin: 0 }}>
                <label className={styles.fieldLabel}>Atas Nama</label>
                <input
                  className={styles.inputField}
                  value={account.accountName}
                  placeholder="PT Mameko Store"
                  onChange={(e) => {
                    const newAccs = [...bankAccounts];
                    newAccs[idx].accountName = e.target.value;
                    updateBankAccounts(newAccs);
                  }}
                />
              </div>
              <button
                type="button"
                style={{ alignSelf: "flex-start", padding: "0.4rem 0.8rem", fontSize: "12px", background: "#ff4d4f", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
                onClick={() => {
                  const newAccs = bankAccounts.filter((_, i) => i !== idx);
                  updateBankAccounts(newAccs);
                }}
              >
                Hapus Rekening
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addRowBtn}
            style={{ marginTop: "0.5rem" }}
            onClick={() => {
              updateBankAccounts([
                ...bankAccounts,
                { id: Date.now().toString(), bankName: "", accountNumber: "", accountName: "" }
              ]);
            }}
          >
            + Tambah Rekening
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: COURIERS — Biteship
   ============================================================ */
function CouriersTab({ settings, updateCouriers, updateBiteshipMode, updateBiteshipAutoOrder }) {
  const activeCouriers = settings.activeCouriers || [];
  const isProduction = settings.biteshipIsProduction ?? false;
  const isAutoOrder = settings.biteshipAutoOrder ?? false;
  const [courierList, setCourierList] = useState([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Fetch daftar kurir dari Biteship
  useEffect(() => {
    const fetchCouriers = async () => {
      setLoadingCouriers(true);
      setFetchError("");
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/biteship/couriers");
        const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        if (data.couriers && data.couriers.length > 0) {
          setCourierList(data.couriers);
        } else {
          // Fallback list jika API belum aktif
          setCourierList([
            { code: "jne", name: "JNE" },
            { code: "jnt", name: "J&T Express" },
            { code: "sicepat", name: "SiCepat" },
            { code: "anteraja", name: "AnterAja" },
            { code: "ninja", name: "Ninja Xpress" },
            { code: "pos", name: "POS Indonesia" },
            { code: "tiki", name: "TIKI" },
            { code: "wahana", name: "Wahana" },
            { code: "lion", name: "Lion Parcel" },
            { code: "ide", name: "ID Express" },
          ]);
        }
      } catch {
        setFetchError("Gagal memuat daftar kurir dari Biteship.");
        setCourierList([
          { code: "jne", name: "JNE" },
          { code: "jnt", name: "J&T Express" },
          { code: "sicepat", name: "SiCepat" },
          { code: "anteraja", name: "AnterAja" },
          { code: "pos", name: "POS Indonesia" },
        ]);
      } finally {
        setLoadingCouriers(false);
      }
    };
    fetchCouriers();
  }, []);

  const handleToggle = (code) => {
    const next = activeCouriers.includes(code)
      ? activeCouriers.filter((c) => c !== code)
      : [...activeCouriers, code];
    updateCouriers(next);
  };

  const selectAll = () => updateCouriers(courierList.map((c) => c.code));
  const clearAll = () => updateCouriers([]);

  return (
    <>
      {/* Mode Biteship */}
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>Mode Biteship</h4>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "1rem" }}>
          Pilih environment Biteship yang akan dipakai untuk kalkulasi ongkos kirim.
          Pastikan API key sudah diatur di <strong>.env.local</strong>.
        </p>
        <select
          className={styles.inputField}
          value={isProduction ? "true" : "false"}
          onChange={(e) => updateBiteshipMode(e.target.value === "true")}
          style={{ maxWidth: "320px" }}
        >
          <option value="false">🧪 Sandbox (Testing)</option>
          <option value="true">🚀 Production (Live)</option>
        </select>
        <small className={styles.fieldDesc} style={{ display: "block", marginTop: "0.5rem" }}>
          Sandbox → <code>BITESHIP_API_KEY_SANDBOX</code> &nbsp;|&nbsp; Production → <code>BITESHIP_API_KEY_PRODUCTION</code>
        </small>
      </div>

      {/* Auto Resi Biteship */}
      <div className={styles.formSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4 className={styles.sectionTitle} style={{ marginBottom: "0.25rem" }}>Sistem Resi Otomatis (Auto-AWB)</h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
              Jika diaktifkan, tombol <strong>"Request Pickup (Biteship)"</strong> akan muncul di halaman kelola pesanan admin.
            </p>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={isAutoOrder}
              onChange={(e) => updateBiteshipAutoOrder(e.target.checked)}
            />
            <span className={styles.slider}></span>
          </label>
        </div>
      </div>

      {/* Kurir Aktif */}
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>Kurir Aktif untuk Checkout</h4>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "1rem" }}>
          Centang kurir yang ingin ditampilkan kepada pelanggan saat checkout.
          {fetchError && <span style={{ color: "#dc2626", marginLeft: "0.5rem" }}>({fetchError})</span>}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button type="button" className={styles.addRowBtn} onClick={selectAll}>Pilih Semua</button>
          <button type="button" className={styles.addRowBtn} onClick={clearAll} style={{ borderColor: "#dc2626", color: "#dc2626" }}>Hapus Semua</button>
        </div>
        {loadingCouriers ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Memuat daftar kurir...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
            {courierList.map((c) => (
              <label key={c.code} className={styles.toggleRow} style={{ cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={activeCouriers.includes(c.code)}
                  onChange={() => handleToggle(c.code)}
                />
                <span className={styles.toggleLabel}>{c.name}</span>
              </label>
            ))}
          </div>
        )}
        <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "1rem" }}>
          Kurir aktif: <strong>{activeCouriers.length > 0 ? activeCouriers.join(", ") : "Tidak ada"}</strong>
        </p>
      </div>
    </>
  );
}

/* ============================================================
   TAB: PRODUCT
   ============================================================ */
function ProductTab({ settings, updateTab, cfg }) {
  const s = settings || { header: { tagline: "", title: { main: "", highlight: "" } } };
  const set = (patch) => updateTab("product", { ...s, ...patch });

  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.sections?.product || "Katalog Produk"}
      </h4>

      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>Tagline (Teks Kecil Atas)</label>
        <input
          className={styles.inputField}
          value={s.header?.tagline || ""}
          onChange={(e) =>
            set({ header: { ...s.header, tagline: e.target.value } })
          }
          placeholder="our curated collection"
        />
      </div>

      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Judul Utama</label>
          <input
            className={styles.inputField}
            value={s.header?.title?.main || ""}
            onChange={(e) =>
              set({
                header: {
                  ...s.header,
                  title: { ...s.header?.title, main: e.target.value },
                },
              })
            }
            placeholder="Produk"
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>Judul Sorotan (Highlight)</label>
          <input
            className={styles.inputField}
            value={s.header?.title?.highlight || ""}
            onChange={(e) =>
              set({
                header: {
                  ...s.header,
                  title: { ...s.header?.title, highlight: e.target.value },
                },
              })
            }
            placeholder="Kami"
          />
        </div>
      </div>
    </div>
  );
}