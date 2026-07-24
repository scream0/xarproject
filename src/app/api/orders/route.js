import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin"; // Firebase Admin SDK untuk backend (Orders & User)
import { createClient } from "@supabase/supabase-js"; // Supabase Client untuk Produk

export const dynamic = "force-dynamic";

// Inisialisasi Supabase Server Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET -> Mengambil Alamat Utama User & Daftar Pesanan dari Firestore
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // 1. Ambil Alamat User dari Firestore
    let userPrimaryAddress = "Belum diatur";
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (
          data.addresses &&
          Array.isArray(data.addresses) &&
          data.addresses.length > 0
        ) {
          const primary =
            data.addresses.find((a) => a.isPrimary) || data.addresses[0];
          userPrimaryAddress = `${primary.label || "Alamat"} - ${primary.recipientName} (${primary.recipientPhone}): ${primary.street}, ${primary.city} (${primary.postalCode})`;
        } else if (data.shipping_address) {
          userPrimaryAddress = data.shipping_address;
        }
      }
    } catch (err) {
      console.error("Gagal mengambil alamat dari Firestore:", err);
    }

    // 2. Ambil Daftar Pesanan dari Firestore (Collection: orders)
    const ordersSnapshot = await db
      .collection("orders")
      .where("userId", "==", userId)
      .get();

    let ordersData = [];
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      ordersData.push({
        id: doc.id,
        ...order,
        // Ubah Firestore Timestamp ke ISO string agar aman dikirim ke client
        createdAt: order.createdAt?.toDate
          ? order.createdAt.toDate().toISOString()
          : order.createdAt,
      });
    });

    // Urutkan pesanan dari yang terbaru
    ordersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({
      success: true,
      primaryAddress: userPrimaryAddress,
      orders: ordersData,
    });
  } catch (error) {
    console.error("Gagal mengambil data orders dari Firestore:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST -> Menyimpan pesanan baru (Termasuk array items keranjang) ke Firestore
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, orderId, order, items, address, status, paymentType } =
      body;

    if (!userId || !orderId) {
      return NextResponse.json(
        { error: "userId and orderId are required" },
        { status: 400 },
      );
    }

    const orderRef = db.collection("orders").doc(orderId);

    await orderRef.set(
      {
        userId: userId,
        orderId: orderId,
        items: items || [], // Menyimpan daftar item belanjaan agar bisa dibaca saat pembaruan stok
        product_name: order?.name || "Katalog Belanja",
        concentration: order?.concentration || "",
        notes: order?.notes || "",
        price: Number(order?.rawPrice || order?.price || 0),
        status: status || "pending",
        payment_type: paymentType || "Midtrans",
        shipping_address: address || null,
        createdAt: new Date(),
      },
      { merge: true },
    );

    return NextResponse.json({
      success: true,
      message: "Pesanan berhasil disimpan ke Firestore",
    });
  } catch (error) {
    console.error("Gagal menyimpan pesanan ke Firestore:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT -> Memperbarui status pesanan (Pembayaran sukses / Konfirmasi Seller) & Mengurangi Stok di Supabase
export async function PUT(request) {
  try {
    const body = await request.json();
    const { orderId, status, shippingReceiptNumber } = body;
    // status bisa berupa: "success", "processing", "shipping", "completed", "cancelled"

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "orderId and status are required" },
        { status: 400 },
      );
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan" },
        { status: 404 },
      );
    }

    const orderData = orderDoc.data();

    // JIKA STATUS BERUBAH MENJADI "success" (Pembayaran Berhasil):
    // Kurangi stok produk yang ada di Supabase berdasarkan item yang dibeli
    if (status === "success" && orderData.status !== "success") {
      const items = orderData.items || [];

      for (const item of items) {
        const productId = String(
          item.id || item.productId || item.product_id || "",
        );
        const orderedSize = String(item.size);
        const orderedQty = Number(item.quantity || item.qty) || 0;

        if (productId && orderedQty > 0) {
          // Ambil data produk dari tabel products di Supabase
          const { data: product, error: fetchError } = await supabase
            .from("products")
            .select("*")
            .eq("id", productId)
            .single();

          if (!fetchError && product) {
            const variants = product.variants || [];

            // Kurangi stok pada varian ukuran yang sesuai (mendukung key stock / stok)
            const updatedVariants = variants.map((v) => {
              if (String(v.size) === orderedSize) {
                const currentStock = Number(v.stock ?? v.stok ?? 0);
                const newStock = Math.max(0, currentStock - orderedQty);
                return {
                  ...v,
                  stock: newStock,
                  stok: newStock,
                };
              }
              return v;
            });

            // Update kembali varian dengan stok baru ke Supabase
            await supabase
              .from("products")
              .update({ variants: updatedVariants })
              .eq("id", productId);
          }
        }
      }
    }

    // Siapkan data untuk diupdate di Firestore
    const updateData = {
        status: status,
        updated_at: new Date(),
    };

    // Tambahkan nomor resi jika ada
    if (shippingReceiptNumber) {
        updateData.shippingReceiptNumber = shippingReceiptNumber;
    }

    // Update status (dan nomor resi jika ada) pesanan di Firestore
    await orderRef.set(updateData, { merge: true });

    return NextResponse.json({
      success: true,
      message: `Status pesanan berhasil diperbarui menjadi ${status} dan stok Supabase diperbarui`,
    });
  } catch (error) {
    console.error("Gagal memperbarui status pesanan & stok:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
