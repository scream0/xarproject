import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin"; // Firebase Admin SDK untuk Orders di Firestore
import { createClient } from "@supabase/supabase-js"; // Supabase Client untuk memotong stok produk

export const dynamic = "force-dynamic";

// Inisialisasi Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// PUT / POST -> Seller/Sistem mengupdate status pesanan & Otomatis Memotong Stok Supabase
export async function PUT(request) {
  return handleUpdateStatus(request);
}

export async function POST(request) {
  return handleUpdateStatus(request);
}

async function handleUpdateStatus(request) {
  try {
    const body = await request.json();
    const { orderId, newStatus, status } = body;

    const targetStatus = newStatus || status;

    if (!orderId || !targetStatus) {
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

    // JIKA STATUS BERUBAH MENJADI SUCCESS / SETTLEMENT (Pembayaran Berhasil):
    // Potong stok di Supabase jika status sebelumnya belum success
    if (
      (targetStatus.toLowerCase() === "success" ||
        targetStatus.toLowerCase() === "settlement") &&
      orderData.status?.toLowerCase() !== "success" &&
      orderData.status?.toLowerCase() !== "settlement"
    ) {
      const items = orderData.items || [];

      for (const item of items) {
        const productId = String(
          item.id || item.productId || item.product_id || "",
        );
        const orderedSize = String(item.size);
        const orderedQty = Number(item.quantity || item.qty) || 1;

        if (productId) {
          // 1. Ambil data produk dari Supabase
          const { data: product, error: fetchErr } = await supabase
            .from("products")
            .select("variants")
            .eq("id", productId)
            .single();

          if (!fetchErr && product && product.variants) {
            let variants = product.variants;

            // 2. Kurangi stok pada varian ukuran yang sesuai (mendukung stock & stok)
            variants = variants.map((v) => {
              if (String(v.size).trim() === orderedSize.trim()) {
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

            // 3. Update kembali ke database Supabase
            const { error: updateErr } = await supabase
              .from("products")
              .update({ variants: variants })
              .eq("id", productId);

            if (updateErr) {
              console.error(
                `Gagal memotong stok Supabase untuk produk ${productId}:`,
                updateErr,
              );
            }
          }
        }
      }
    }

    // Update status pesanan di Firestore
    await orderRef.set(
      {
        status: targetStatus,
        updated_at: new Date(),
      },
      { merge: true },
    );

    return NextResponse.json({
      success: true,
      message: `Status pesanan berhasil diubah menjadi ${targetStatus} dan stok Supabase berhasil dipotong!`,
    });
  } catch (error) {
    console.error("Gagal mengupdate status pesanan & stok:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
 