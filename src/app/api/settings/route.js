import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Helper to check for admin privileges (Supports Custom Claims & Firestore users collection)
async function verifyAdmin(authHeader) {
  if (!authHeader) throw new Error("No authorization header.");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Invalid token format.");

  const decodedToken = await getAuth().verifyIdToken(token);
  const uid = decodedToken.uid;

  // 1. Cek dari Firebase Auth Custom Claims (Token)
  if (decodedToken.role === "admin" || decodedToken.admin === true) {
    return decodedToken;
  }

  // 2. Cek dari Firebase Auth Custom Claims (User Record)
  try {
    const userRecord = await getAuth().getUser(uid);
    if (
      userRecord.customClaims?.role === "admin" ||
      userRecord.customClaims?.admin === true
    ) {
      return decodedToken;
    }
  } catch {
    // Abaikan jika gagal ambil user record
  }

  // 3. Fallback: Cek langsung dari dokumen Firestore koleksi 'users'
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === "admin") {
      return decodedToken;
    }
  } catch {
    // Abaikan jika gagal cek database
  }

  throw new Error("User is not an administrator.");
}

const settingsDocRef = db.collection("store_config").doc("main");

/**
 * Default lengkap settings — dipakai saat dokumen belum pernah dibuat,
 * dan sebagai dasar akuisisi data landing page dari JSON config statis.
 */
const DEFAULT_SETTINGS = {
  storeName: "XAR Perfume",
  storeEmail: "contact@xar.com",
  currency: "IDR",
  lowStockThreshold: 10,
  storeCityId: "",
  storeCityName: "",
  midtransServerKey: "",
  midtransClientKey: "",

  // Hero Section
  hero: {
    tagline: "Artisanal Craftsmanship",
    title: {
      main: "Meracik Batas Antara",
      highlight: "Aroma & Rasa",
    },
    description: {
      prefix: "Eksplorasi mahakarya ",
      italic: "Extrait de Parfum",
      suffix:
        " berkonsentrasi tinggi dan kopi arabica pilihan. Dibuat manual dalam jumlah terbatas untuk Anda yang menghargai identitas.",
    },
    buttons: {
      primary: { label: "Jelajahi Koleksi", href: "#product" },
      secondary: { label: "The Story", href: "#about" },
    },
  },

  // About Section
  about: {
    image: "/assets/images/about-bg.jpg",
    imageAlt: "Artisanal Craftsmanship",
    imagePublicId: "",
    content: {
      tagline: "The Story Behind",
      heading: "The Essence of Artisanal Perfection.",
      leadText:
        "MAMEKO mendefinisikan ulang kemewahan melalui keheningan aroma dan kedalaman karakter yang terakurasi.",
      bodyText:
        "Kami percaya bahwa apa yang Anda kenakan adalah representasi paling jujur dari identitas diri. Setiap rilisan diracik secara manual dalam jumlah terbatas untuk memastikan eksklusivitas.",
    },
    features: [
      {
        number: "01",
        title: "Premium Concentration",
        desc: "Konsentrat tertinggi untuk ketahanan aroma sepanjang hari.",
      },
      {
        number: "02",
        title: "Artisanal Blend",
        desc: "Racikan manual yang menjaga keaslian setiap karakter aroma.",
      },
    ],
  },

  // Product Section
  product: {
    header: {
      tagline: "our curated collection",
      title: { main: "Produk", highlight: "Kami" },
    },
  },

  // Contact Section
  contact: {
    whatsappNumber: "6285171723607",
    header: {
      tagline: "Get In Touch",
      title: { main: "Ada Pertanyaan?", highlight: "Hubungi Kami" },
    },
    infoItems: [
      {
        icon: "mail",
        title: "Email Resmi",
        value: "support@mameko.my.id",
      },
      {
        icon: "clock",
        title: "Jam Operasional",
        value: "Setiap Hari (18:00 - 21:00 WIB)",
      },
      {
        icon: "map-pin",
        title: "Lokasi Galeri",
        value: "Sleman, Yogyakarta, Indonesia",
      },
    ],
    headquarters: {
      title: "Headquarters",
      address: [
        "Tegalrejo Wedomartani, Kabupaten Sleman,",
        "Daerah Istimewa Yogyakarta 55584",
      ],
      coordinates: '07° 43\' 36.2" S | 110° 25\' 35.3" E',
    },
    form: {
      title: "Kirim Pesan Instan",
      fields: {
        name: "Nama Lengkap",
        email: "Alamat Email",
        phone: "Nomor WhatsApp",
        message: "Tulis Pesan Anda...",
      },
      submitText: "Kirim via WhatsApp",
    },
  },

  // Footer Section
  footer: {
    branding: {
      logo: { text: "MAKE ", subtext: "ME KOOL", href: "#" },
      description:
        "Meracik setiap produk dengan penuh perhatian untuk memberikan kualitas aroma dan rasa terbaik langsung ke tangan Anda.",
      socials: [
        {
          href: "https://www.instagram.com/xar.project/",
          icon: "instagram",
          label: "Instagram",
        },
        { href: "#product", icon: "shopping-bag", label: "Shop" },
      ],
    },
    navigation: {
      title: "Penjelajahan",
      links: [
        { label: "Home", href: "#home" },
        { label: "Tentang Kami", href: "#about" },
        { label: "Produk", href: "#product" },
        { label: "Kontak", href: "#contact" },
      ],
    },
    payment: {
      title: "Pembayaran",
      subtitle: "Didukung secara aman oleh:",
      methods: ["Midtrans", "QRIS"],
    },
    copyright: { text: "Make Me Kool. All rights reserved." },
  },

  // Promo Section
  promoBannerEnabled: false,
  promoBannerText: "Diskon khusus untuk pelanggan setia",
  promoDiscountType: "percentage", // "percentage" | "fixed"
  promoDiscountValue: 0,
  promoStartDate: "",
  promoEndDate: "",
  promoCode: "",
  promoDestination: "#product",
};

// Helper: sanitasi data undefined agar aman untuk Firestore
function sanitizeData(obj) {
  const cleanObj = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key]) &&
        !(obj[key] instanceof Date)
      ) {
        cleanObj[key] = sanitizeData(obj[key]);
      } else {
        cleanObj[key] = obj[key];
      }
    }
  }
  return cleanObj;
}

// Helper: pastikan doc settings dibuat + isi field yang hilang dengan default
async function ensureSettingsDoc() {
  const doc = await settingsDocRef.get();
  if (!doc.exists) {
    await settingsDocRef.set(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }

  const existing = doc.data();
  const merged = {
    ...DEFAULT_SETTINGS,
    ...existing,
    // Gabungkan objek bersarang secara shallow agar field baru tetap muncul
    hero: { ...DEFAULT_SETTINGS.hero, ...(existing.hero || {}) },
    about: { ...DEFAULT_SETTINGS.about, ...(existing.about || {}) },
    product: { ...DEFAULT_SETTINGS.product, ...(existing.product || {}) },
    contact: { ...DEFAULT_SETTINGS.contact, ...(existing.contact || {}) },
    footer: { ...DEFAULT_SETTINGS.footer, ...(existing.footer || {}) },
  };
  return merged;
}

// GET -> Fetch store settings
// - Tanpa token + ?public=true => data aman untuk landing page publik
// - Dengan token admin => data lengkap (termasuk midtrans masked)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get("public") === "true";

    // Mode publik: tidak perlu auth
    if (isPublic) {
      const settings = await ensureSettingsDoc();
      // Hapus semua field sensitif dari respon publik
      const publicSafe = { ...settings };
      delete publicSafe.midtransServerKey;
      delete publicSafe.midtransClientKey;
      return new Response(JSON.stringify(publicSafe), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mode admin: wajib auth
    await verifyAdmin(request.headers.get("Authorization"));
    const settings = await ensureSettingsDoc();

    // Mask sensitive keys before sending to the client
    const clientSafeSettings = {
      ...settings,
      midtransServerKey: settings.midtransServerKey
        ? "••••••••••••••••••••••••••••••••"
        : "",
      midtransClientKey: settings.midtransClientKey
        ? "••••••••••••••••••••"
        : "",
    };

    return new Response(JSON.stringify(clientSafeSettings), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Verification failed: ${error.message}` }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}

// PUT -> Update store settings (admin only)
export async function PUT(request) {
  try {
    await verifyAdmin(request.headers.get("Authorization"));
    const newSettings = await request.json();

    // Ambil settings saat ini agar merge object bersarang tetap lengkap
    const current = await ensureSettingsDoc();

    const updateData = {};

    // Fields store
    if (newSettings.storeName !== undefined)
      updateData.storeName = newSettings.storeName;
    if (newSettings.storeEmail !== undefined)
      updateData.storeEmail = newSettings.storeEmail;
    if (newSettings.currency !== undefined)
      updateData.currency = newSettings.currency;
    if (newSettings.lowStockThreshold !== undefined)
      updateData.lowStockThreshold = Number(newSettings.lowStockThreshold);
    if (newSettings.storeCityId !== undefined)
      updateData.storeCityId = String(newSettings.storeCityId || "");
    if (newSettings.storeCityName !== undefined)
      updateData.storeCityName = String(newSettings.storeCityName || "");
    if (newSettings.promoBannerEnabled !== undefined)
      updateData.promoBannerEnabled = Boolean(newSettings.promoBannerEnabled);
    if (newSettings.promoBannerText !== undefined)
      updateData.promoBannerText = newSettings.promoBannerText;
    if (newSettings.promoDiscountType !== undefined)
      updateData.promoDiscountType =
        newSettings.promoDiscountType === "fixed"
          ? "fixed"
          : "percentage";
    if (newSettings.promoDiscountValue !== undefined)
      updateData.promoDiscountValue = Number(
        newSettings.promoDiscountValue || 0,
      );
    if (newSettings.promoStartDate !== undefined)
      updateData.promoStartDate = newSettings.promoStartDate;
    if (newSettings.promoEndDate !== undefined)
      updateData.promoEndDate = newSettings.promoEndDate;
    if (newSettings.promoCode !== undefined)
      updateData.promoCode = String(newSettings.promoCode || "").toUpperCase();
    if (newSettings.promoDestination !== undefined)
      updateData.promoDestination = newSettings.promoDestination;

    // Landing object bersarang
    if (newSettings.hero) {
      updateData.hero = sanitizeData({
        ...(current.hero || {}),
        ...newSettings.hero,
      });
    }
    if (newSettings.about) {
      updateData.about = sanitizeData({
        ...(current.about || {}),
        ...newSettings.about,
        content: {
          ...(current.about?.content || {}),
          ...(newSettings.about.content || {}),
        },
      });
      // Pasang image/alt/publicId jika dikirim sebagai bagian about
      if (newSettings.about.image !== undefined)
        updateData.about.image = newSettings.about.image;
      if (newSettings.about.imageAlt !== undefined)
        updateData.about.imageAlt = newSettings.about.imageAlt;
      if (newSettings.about.imagePublicId !== undefined)
        updateData.about.imagePublicId = newSettings.about.imagePublicId;
    }
    if (newSettings.product) {
      updateData.product = sanitizeData({
        ...(current.product || {}),
        ...newSettings.product,
      });
    }
    if (newSettings.contact) {
      updateData.contact = sanitizeData({
        ...(current.contact || {}),
        ...newSettings.contact,
        header: {
          ...(current.contact?.header || {}),
          ...(newSettings.contact.header || {}),
        },
        headquarters: {
          ...(current.contact?.headquarters || {}),
          ...(newSettings.contact.headquarters || {}),
        },
      });
    }
    if (newSettings.footer) {
      updateData.footer = sanitizeData({
        ...(current.footer || {}),
        ...newSettings.footer,
        branding: {
          ...(current.footer?.branding || {}),
          ...(newSettings.footer.branding || {}),
        },
        navigation: {
          ...(current.footer?.navigation || {}),
          ...(newSettings.footer.navigation || {}),
        },
        payment: {
          ...(current.footer?.payment || {}),
          ...(newSettings.footer.payment || {}),
        },
      });
    }

    // Handle sensitive keys: only update if a new, non-placeholder value is provided
    let envFileContent = "";
    const envPath = path.resolve(process.cwd(), ".env.local");

    try {
      envFileContent = await fs.readFile(envPath, "utf8");
    } catch {
      // .env.local might not exist, that's okay
    }

    if (
      newSettings.midtransServerKey &&
      typeof newSettings.midtransServerKey === "string" &&
      !newSettings.midtransServerKey.includes("•")
    ) {
      updateData.midtransServerKey = newSettings.midtransServerKey;
      envFileContent = updateEnvVariable(
        envFileContent,
        "MIDTRANS_SERVER_KEY",
        newSettings.midtransServerKey,
      );
    }
    if (
      newSettings.midtransClientKey &&
      typeof newSettings.midtransClientKey === "string" &&
      !newSettings.midtransClientKey.includes("•")
    ) {
      updateData.midtransClientKey = newSettings.midtransClientKey;
      envFileContent = updateEnvVariable(
        envFileContent,
        "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY",
        newSettings.midtransClientKey,
      );
    }

    if (Object.keys(updateData).length > 0) {
      await settingsDocRef.set(sanitizeData(updateData), { merge: true });
    }

    if (envFileContent) {
      await fs.writeFile(envPath, envFileContent);
    }

    return new Response(
      JSON.stringify({ message: "Settings updated successfully." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Failed to update settings:", error);
    return new Response(
      JSON.stringify({ error: `Update failed: ${error.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

function updateEnvVariable(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  const newEntry = `${key}="${value}"`;
  if (regex.test(content)) {
    return content.replace(regex, newEntry);
  } else {
    return content + `\n${newEntry}`;
  }
}

