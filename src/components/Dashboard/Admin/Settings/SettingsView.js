"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import styles from "./SettingsView.module.css";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import settingsConfig from "@/data/ui/settingsConfig.json";
import {
  getAdminSettings,
  saveSettings,
} from "@/services/settingsService";

const EMPTY = {
  store: {
    storeName: "",
    storeEmail: "",
    currency: "IDR",
    lowStockThreshold: 10,
    productSectionImage: "/assets/produk/crush.jpg",
    productSectionImageAlt: "Produk unggulan XAR",
    productSectionImagePublicId: "",
    midtransServerKey: "",
    midtransClientKey: "",
  },
  hero: {
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
    content: { tagline: "", heading: "", leadText: "", bodyText: "" },
    features: [{ number: "01", title: "", desc: "" }],
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
  promo: {
    promoBannerEnabled: false,
    promoBannerText: "",
  },
};

const TAB_KEYS = [
  "store",
  "hero",
  "about",
  "contact",
  "footer",
  "promo",
  "payment",
];

export default function SettingsView() {
  const [settings, setSettings] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [activeTab, setActiveTab] = useState("store");
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const cfg = settingsConfig;

  // Map dari settings DB ke state lokal bertab
  const mapSettingsToState = (data) => ({
    store: {
      storeName: data?.storeName || "",
      storeEmail: data?.storeEmail || "",
      currency: data?.currency || "IDR",
      lowStockThreshold: Number(data?.lowStockThreshold ?? 10),
      productSectionImage: data?.productSectionImage || "",
      productSectionImageAlt: data?.productSectionImageAlt || "",
      productSectionImagePublicId: data?.productSectionImagePublicId || "",
      midtransServerKey: data?.midtransServerKey || "",
      midtransClientKey: data?.midtransClientKey || "",
    },
    hero: {
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
      content: {
        tagline: data?.about?.content?.tagline || "",
        heading: data?.about?.content?.heading || "",
        leadText: data?.about?.content?.leadText || "",
        bodyText: data?.about?.content?.bodyText || "",
      },
      features: data?.about?.features || [{ number: "01", title: "", desc: "" }],
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
    promo: {
      promoBannerEnabled: Boolean(data?.promoBannerEnabled),
      promoBannerText: data?.promoBannerText || "",
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        toast.error(cfg.toast?.authRequired || "Authentication required.");
        setIsFetching(false);
        return;
      }

      try {
        const data = await getAdminSettings(currentUser);
        setSettings(mapSettingsToState(data));
        setImagePreviewUrl(data?.productSectionImage || "");
      } catch (error) {
        console.error("Fetch Settings Error:", error.message);
        toast.error(error.message);
      } finally {
        setIsFetching(false);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(cfg.buttons?.saving || "Menyimpan...");
    setLoading(true);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error(cfg.toast?.sessionExpired || "Sesi berakhir.", {
        id: toastId,
      });
      setLoading(false);
      return;
    }

    try {
      const payload = buildPayload();

      // Unggah gambar section produk jika ada file baru
      if (selectedImageFile) {
        setUploadingImage(true);
        const formData = new FormData();
        formData.append("file", selectedImageFile);
        formData.append("userId", currentUser.uid);
        formData.append("folder", "storefront");
        formData.append(
          "publicId",
          `storefront/product-section-${currentUser.uid}`,
        );
        formData.append(
          "oldPublicId",
          settings.store.productSectionImagePublicId || "",
        );
        formData.append(
          "oldUrl",
          settings.store.productSectionImage || "",
        );

        const uploadRes = await fetch("/api/cloudinary", {
          method: "POST",
          body: formData,
        });
        const uploadResult = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadResult.error || "Gagal mengunggah gambar.");
        }

        payload.productSectionImage = uploadResult.secure_url;
        payload.productSectionImagePublicId = uploadResult.public_id;
        setImagePreviewUrl(uploadResult.secure_url);
        setSelectedImageFile(null);
        setUploadingImage(false);
      }

      await saveSettings(payload, currentUser);

      const fresh = await getAdminSettings(currentUser);
      setSettings(mapSettingsToState(fresh));
      setImagePreviewUrl(fresh?.productSectionImage || "");

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
      lowStockThreshold: Number(s.store.lowStockThreshold) || 10,
      productSectionImage: strictValue(s.store.productSectionImage),
      productSectionImageAlt: strictValue(s.store.productSectionImageAlt),
      productSectionImagePublicId: strictValue(
        s.store.productSectionImagePublicId,
      ),
      midtransServerKey: strictValue(s.store.midtransServerKey),
      midtransClientKey: strictValue(s.store.midtransClientKey),
      hero: {
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
        content: {
          tagline: strictValue(s.about.content?.tagline),
          heading: strictValue(s.about.content?.heading),
          leadText: strictValue(s.about.content?.leadText),
          bodyText: strictValue(s.about.content?.bodyText),
        },
        features: s.about.features || [],
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
      promoBannerEnabled: Boolean(s.promo.promoBannerEnabled),
      promoBannerText: strictValue(s.promo.promoBannerText),
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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
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
            className={`${styles.tabBtn} ${
              activeTab === key ? styles.tabBtnActive : ""
            }`}
            onClick={() => setActiveTab(key)}
          >
            {cfg.tabs?.[key] || key}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {activeTab === "store" && (
          <StoreTab
            settings={settings.store}
            handleInputChange={handleInputChange}
            handleImageSelect={handleImageSelect}
            imagePreviewUrl={imagePreviewUrl}
            cfg={cfg}
          />
        )}

        {activeTab === "hero" && (
          <HeroTab settings={settings.hero} updateTab={updateTab} cfg={cfg} />
        )}

        {activeTab === "about" && (
          <AboutTab settings={settings.about} updateTab={updateTab} cfg={cfg} />
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

        {activeTab === "promo" && (
          <PromoTab settings={settings.promo} updateTab={updateTab} cfg={cfg} />
        )}

        {activeTab === "payment" && (
          <PaymentTab
            settings={settings.store}
            handleInputChange={handleInputChange}
            cfg={cfg}
          />
        )}

        <button
          type="submit"
          disabled={loading || uploadingImage}
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
function StoreTab({ settings, handleInputChange, handleImageSelect, imagePreviewUrl, cfg }) {
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
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.sections?.visuals || "Visual Section Produk"}
        </h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.labels?.productSectionImage || "Gambar Section Produk"}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className={styles.fileInput}
          />
          <small className={styles.fieldDesc}>Unggah gambar section produk.</small>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.labels?.productSectionImageAlt || "Deskripsi Gambar"}
          </label>
          <input
            type="text"
            name="productSectionImageAlt"
            value={settings.productSectionImageAlt || ""}
            onChange={handleInputChange}
            className={styles.inputField}
          />
        </div>
        {(imagePreviewUrl || settings.productSectionImage) && (
          <div className={styles.previewCard}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic blob & Cloudinary preview URLs require a plain <img>. */}
            <img
              src={imagePreviewUrl || settings.productSectionImage}
              alt={settings.productSectionImageAlt || "Preview"}
              className={styles.previewImage}
            />
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   TAB: HERO
   ============================================================ */
function HeroTab({ settings, updateTab, cfg }) {
  const s = settings;
  const set = (patch) => updateTab("hero", { ...s, ...patch });

  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.sections?.hero || "Hero Section"}
      </h4>
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
function AboutTab({ settings, updateTab, cfg }) {
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
   TAB: PROMO
   ============================================================ */
function PromoTab({ settings, updateTab, cfg }) {
  const s = settings;
  const set = (patch) => updateTab("promo", { ...s, ...patch });

  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.sections?.promo || "Banner Promo"}
      </h4>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>Aktifkan Banner Promo</label>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={Boolean(s.promoBannerEnabled)}
            onChange={(e) => set({ promoBannerEnabled: e.target.checked })}
            className={styles.toggleInput}
          />
          <span className={styles.toggleLabel}>Tampilkan di landing page</span>
        </label>
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>Teks Banner Promo</label>
        <input
          className={styles.inputField}
          value={s.promoBannerText}
          onChange={(e) => set({ promoBannerText: e.target.value })}
          placeholder={cfg.placeholders?.promoBannerText || ""}
        />
      </div>
    </div>
  );
}

/* ============================================================
   TAB: PAYMENT
   ============================================================ */
function PaymentTab({ settings, handleInputChange, cfg }) {
  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.sections?.paymentKeys || "Kunci API Gateway Pembayaran"}
      </h4>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>
          {cfg.labels?.midtransServerKey || "Midtrans Server Key"}
        </label>
        <input
          type="password"
          name="midtransServerKey"
          value={settings.midtransServerKey}
          onChange={handleInputChange}
          className={styles.inputField}
          placeholder={cfg.placeholders?.updateKey || ""}
        />
        <small className={styles.fieldDesc}>
          {cfg.descriptions?.midtransServerKey ||
            "Kunci ini bersifat rahasia dan tidak akan pernah ditampilkan lagi."}
        </small>
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>
          {cfg.labels?.midtransClientKey || "Midtrans Client Key"}
        </label>
        <input
          type="password"
          name="midtransClientKey"
          value={settings.midtransClientKey}
          onChange={handleInputChange}
          className={styles.inputField}
          placeholder={cfg.placeholders?.updateKey || ""}
        />
      </div>
    </div>
  );
}

