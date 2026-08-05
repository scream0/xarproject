import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS = {
  storeName: "XAR Perfume",
  storeEmail: "contact@xar.com",
  currency: "IDR",
  adminLocale: "id",
  lowStockThreshold: 10,
  storeCityId: "",
  storeCityName: "",
  midtransServerKey: "",
  midtransClientKey: "",
  hero: {
    tagline: "Artisanal Craftsmanship",
    title: { main: "Meracik Batas Antara", highlight: "Aroma & Rasa" },
    description: {
      prefix: "Eksplorasi mahakarya ",
      italic: "Extrait de Parfum",
      suffix: " berkonsentrasi tinggi dan kopi arabica pilihan. Dibuat manual dalam jumlah terbatas untuk Anda yang menghargai identitas.",
    },
    buttons: {
      primary: { label: "Jelajahi Koleksi", href: "#product" },
      secondary: { label: "The Story", href: "#about" },
    },
  },
  about: {
    image: "/assets/images/about-bg.jpg",
    imageAlt: "Artisanal Craftsmanship",
    imagePublicId: "",
    content: {
      tagline: "The Story Behind",
      heading: "The Essence of Artisanal Perfection.",
      leadText: "MAMEKO mendefinisikan ulang kemewahan melalui keheningan aroma dan kedalaman karakter yang terakurasi.",
      bodyText: "Kami percaya bahwa apa yang Anda kenakan adalah representasi paling jujur dari identitas diri. Setiap rilisan diracik secara manual dalam jumlah terbatas untuk memastikan eksklusivitas.",
    },
    features: [
      { number: "01", title: "Premium Concentration", desc: "Konsentrat tertinggi untuk ketahanan aroma sepanjang hari." },
      { number: "02", title: "Artisanal Blend", desc: "Racikan manual yang menjaga keaslian setiap karakter aroma." },
    ],
  },
  product: {
    header: {
      tagline: "our curated collection",
      title: { main: "Produk", highlight: "Kami" },
    },
  },
  contact: {
    whatsappNumber: "6285171723607",
    header: {
      tagline: "Get In Touch",
      title: { main: "Ada Pertanyaan?", highlight: "Hubungi Kami" },
    },
    infoItems: [
      { icon: "mail", title: "Email Resmi", value: "support@mameko.my.id" },
      { icon: "clock", title: "Jam Operasional", value: "Setiap Hari (18:00 - 21:00 WIB)" },
      { icon: "map-pin", title: "Lokasi Galeri", value: "Sleman, Yogyakarta, Indonesia" },
    ],
    headquarters: {
      title: "Headquarters",
      address: ["Tegalrejo Wedomartani, Kabupaten Sleman,", "Daerah Istimewa Yogyakarta 55584"],
      coordinates: `07° 43' 36.2" S | 110° 25' 35.3" E`,
    },
    form: {
      title: "Kirim Pesan Instan",
      fields: { name: "Nama Lengkap", email: "Alamat Email", phone: "Nomor WhatsApp", message: "Tulis Pesan Anda..." },
      submitText: "Kirim via WhatsApp",
    },
  },
  footer: {
    branding: {
      logo: { text: "MAKE ", subtext: "ME KOOL", href: "#" },
      description: "Meracik setiap produk dengan penuh perhatian untuk memberikan kualitas aroma dan rasa terbaik langsung ke tangan Anda.",
      socials: [
        { href: "https://www.instagram.com/xar.project/", icon: "instagram", label: "Instagram" },
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
  promoBannerEnabled: false,
  promoBannerText: "Diskon khusus untuk pelanggan setia",
  promoDiscountType: "percentage",
  promoDiscountValue: 0,
  promoStartDate: "",
  promoEndDate: "",
  promoCode: "",
  promoDestination: "#product",
};

async function verifyAdmin(authHeader) {
  if (!authHeader) throw new Error("No authorization header.");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Invalid token format.");

  const { data: { user }, error: userError } = await supabaseAdmin.auth.api.getUser(token);
  if (userError) throw new Error(`Invalid token: ${userError.message}`);
  
  const uid = user.id;

  if (user.user_metadata?.role === "admin") {
    return user;
  }

  try {
    const { data, error } = await supabaseAdmin.from("users").select("role").eq("id", uid).single();
    if (error) throw error;
    if (data && data.role === "admin") {
      return user;
    }
  } catch (dbError) {
    console.error("Error checking user role in DB:", dbError.message);
  }

  throw new Error("User is not an administrator.");
}

async function ensureSettingsDoc() {
  const { data, error } = await supabaseAdmin.from("store_config").select("*").eq("singleton_id", true).single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch settings: ${error.message}`);
  }

  if (!data) {
    const { error: insertError } = await supabaseAdmin.from("store_config").insert({ ...DEFAULT_SETTINGS, singleton_id: true });
    if (insertError) throw new Error(`Failed to create default settings: ${insertError.message}`);
    return { ...DEFAULT_SETTINGS };
  }

  const existing = data;
  const merged = {
    ...DEFAULT_SETTINGS,
    ...existing,
    hero: { ...DEFAULT_SETTINGS.hero, ...(existing.hero || {}) },
    about: { ...DEFAULT_SETTINGS.about, ...(existing.about || {}) },
    product: { ...DEFAULT_SETTINGS.product, ...(existing.product || {}) },
    contact: { ...DEFAULT_SETTINGS.contact, ...(existing.contact || {}) },
    footer: { ...DEFAULT_SETTINGS.footer, ...(existing.footer || {}) },
  };
  return merged;
}

function sanitizeData(obj) {
  const cleanObj = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
        cleanObj[key] = sanitizeData(obj[key]);
      } else {
        cleanObj[key] = obj[key];
      }
    }
  }
  return cleanObj;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get("public") === "true";

    if (isPublic) {
      const settings = await ensureSettingsDoc();
      const publicSafe = { ...settings };
      delete publicSafe.midtransServerKey;
      delete publicSafe.midtransClientKey;
      return new Response(JSON.stringify(publicSafe), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    await verifyAdmin(request.headers.get("Authorization"));
    const settings = await ensureSettingsDoc();

    const clientSafeSettings = {
      ...settings,
      midtransServerKey: settings.midtransServerKey ? "••••••••••••••••••••••••••••••••" : "",
      midtransClientKey: settings.midtransClientKey ? "••••••••••••••••••••" : "",
    };

    return new Response(JSON.stringify(clientSafeSettings), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Verification failed: ${error.message}` }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function PUT(request) {
  try {
    await verifyAdmin(request.headers.get("Authorization"));
    const newSettings = await request.json();
    const current = await ensureSettingsDoc();
    const updateData = {};

    if (newSettings.storeName !== undefined) updateData.storeName = newSettings.storeName;
    if (newSettings.storeEmail !== undefined) updateData.storeEmail = newSettings.storeEmail;
    if (newSettings.currency !== undefined) updateData.currency = newSettings.currency;
    if (newSettings.adminLocale !== undefined) updateData.adminLocale = String(newSettings.adminLocale).toLowerCase() === "en" ? "en" : "id";
    if (newSettings.lowStockThreshold !== undefined) updateData.lowStockThreshold = Number(newSettings.lowStockThreshold);
    if (newSettings.storeCityId !== undefined) updateData.storeCityId = String(newSettings.storeCityId || "");
    if (newSettings.storeCityName !== undefined) updateData.storeCityName = String(newSettings.storeCityName || "");
    if (newSettings.promoBannerEnabled !== undefined) updateData.promoBannerEnabled = Boolean(newSettings.promoBannerEnabled);
    if (newSettings.promoBannerText !== undefined) updateData.promoBannerText = newSettings.promoBannerText;
    if (newSettings.promoDiscountType !== undefined) updateData.promoDiscountType = newSettings.promoDiscountType === "fixed" ? "fixed" : "percentage";
    if (newSettings.promoDiscountValue !== undefined) updateData.promoDiscountValue = Number(newSettings.promoDiscountValue || 0);
    if (newSettings.promoStartDate !== undefined) updateData.promoStartDate = newSettings.promoStartDate;
    if (newSettings.promoEndDate !== undefined) updateData.promoEndDate = newSettings.promoEndDate;
    if (newSettings.promoCode !== undefined) updateData.promoCode = String(newSettings.promoCode || "").toUpperCase();
    if (newSettings.promoDestination !== undefined) updateData.promoDestination = newSettings.promoDestination;

    if (newSettings.hero) updateData.hero = sanitizeData({ ...(current.hero || {}), ...newSettings.hero });
    if (newSettings.about) {
      updateData.about = sanitizeData({
        ...(current.about || {}),
        ...newSettings.about,
        content: { ...(current.about?.content || {}), ...(newSettings.about.content || {}) },
      });
      if (newSettings.about.image !== undefined) updateData.about.image = newSettings.about.image;
      if (newSettings.about.imageAlt !== undefined) updateData.about.imageAlt = newSettings.about.imageAlt;
      if (newSettings.about.imagePublicId !== undefined) updateData.about.imagePublicId = newSettings.about.imagePublicId;
    }
    if (newSettings.product) updateData.product = sanitizeData({ ...(current.product || {}), ...newSettings.product });
    if (newSettings.contact) {
      updateData.contact = sanitizeData({
        ...(current.contact || {}),
        ...newSettings.contact,
        header: { ...(current.contact?.header || {}), ...(newSettings.contact.header || {}) },
        headquarters: { ...(current.contact?.headquarters || {}), ...(newSettings.contact.headquarters || {}) },
      });
    }
    if (newSettings.footer) {
      updateData.footer = sanitizeData({
        ...(current.footer || {}),
        ...newSettings.footer,
        branding: { ...(current.footer?.branding || {}), ...(newSettings.footer.branding || {}) },
        navigation: { ...(current.footer?.navigation || {}), ...(newSettings.footer.navigation || {}) },
        payment: { ...(current.footer?.payment || {}), ...(newSettings.footer.payment || {}) },
      });
    }

    let envFileContent = "";
    const envPath = path.resolve(process.cwd(), ".env.local");
    try {
      envFileContent = await fs.readFile(envPath, "utf8");
    } catch {}

    if (newSettings.midtransServerKey && typeof newSettings.midtransServerKey === "string" && !newSettings.midtransServerKey.includes("•")) {
      updateData.midtransServerKey = newSettings.midtransServerKey;
      envFileContent = updateEnvVariable(envFileContent, "MIDTRANS_SERVER_KEY", newSettings.midtransServerKey);
    }
    if (newSettings.midtransClientKey && typeof newSettings.midtransClientKey === "string" && !newSettings.midtransClientKey.includes("•")) {
      updateData.midtransClientKey = newSettings.midtransClientKey;
      envFileContent = updateEnvVariable(envFileContent, "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY", newSettings.midtransClientKey);
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabaseAdmin.from("store_config").upsert({ ...updateData, singleton_id: true }, { onConflict: 'singleton_id' });
      if (error) throw new Error(`Failed to update settings: ${error.message}`);
    }

    if (envFileContent) {
      await fs.writeFile(envPath, envFileContent);
    }

    return new Response(JSON.stringify({ message: "Settings updated successfully." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return new Response(
      JSON.stringify({ error: `Update failed: ${error.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function updateEnvVariable(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  const newEntry = `${key}="${value}"`;
  if (regex.test(content)) {
    return content.replace(regex, newEntry);
  } else {
    return content + `
${newEntry}`;
  }
}
