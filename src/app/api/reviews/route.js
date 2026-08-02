import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// Helper untuk verifikasi token Firebase dari client
async function verifyUser(authHeader) {
  if (!authHeader) {
    throw new Error("No authorization header provided.");
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    throw new Error("Invalid authorization header format.");
  }
  return getAuth().verifyIdToken(token);
}

// Helper untuk verifikasi bahwa user adalah admin (Mendukung Custom Claims & Firestore users collection)
async function verifyAdmin(authHeader) {
  const decodedToken = await verifyUser(authHeader);
  const uid = decodedToken.uid;

  if (decodedToken.role === "admin" || decodedToken.admin === true) {
    return decodedToken;
  }

  try {
    const user = await getAuth().getUser(uid);
    if (
      user.customClaims?.role === "admin" ||
      user.customClaims?.admin === true
    ) {
      return decodedToken;
    }
  } catch (e) {}

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === "admin") {
      return decodedToken;
    }
  } catch (e) {}

  throw new Error("User is not an administrator.");
}

// POST -> Kirim Review Baru (per-item, auto-approved)
export async function POST(request) {
  try {
    let decodedToken;
    try {
      decodedToken = await verifyUser(request.headers.get("Authorization"));
    } catch (error) {
      return Response.json(
        { error: `Authentication failed: ${error.message}` },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId, orderId, productId, productName, rating, comment } = body;

    if (decodedToken.uid !== userId) {
      return Response.json(
        {
          error: "User ID mismatch. You can only submit reviews for yourself.",
        },
        { status: 403 },
      );
    }
    if (!orderId || !productId || !rating || !comment) {
      return Response.json(
        {
          error:
            "Missing required fields: orderId, productId, rating, comment.",
        },
        { status: 400 },
      );
    }

    const orderRef = db.collection("orders").doc(orderId);
    const productIdStr = String(productId);

    const result = await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new Error("Order not found.");
      }

      const orderData = orderDoc.data();
      if (orderData.userId !== userId) {
        throw new Error("You are not authorized to review this order.");
      }

      const reviewedItemIds = Array.isArray(orderData.reviewedItemIds)
        ? orderData.reviewedItemIds
        : [];

      if (reviewedItemIds.includes(productIdStr)) {
        throw new Error("Produk ini pada pesanan tersebut sudah diulas.");
      }

      // Cek juga apakah sudah ada review dengan orderId + productId yang sama
      // (double-check di luar transaction-read agar tidak duplikat)
      const existingReviewSnap = await db
        .collection("reviews")
        .where("orderId", "==", orderId)
        .where("productId", "==", productIdStr)
        .limit(1)
        .get();

      if (!existingReviewSnap.empty) {
        throw new Error("Produk ini pada pesanan tersebut sudah diulas.");
      }

      const newReviewRef = db.collection("reviews").doc();
      transaction.create(newReviewRef, {
        userId,
        userName: decodedToken.name || decodedToken.email || "Pelanggan",
        orderId,
        productId: productIdStr,
        productName: productName || "Product",
        rating: Number(rating),
        comment,
        createdAt: FieldValue.serverTimestamp(),
        // Auto-approve: review langsung tayang di halaman produk.
        // Admin tetap bisa sembunyikan (approved:false) atau hapus lewat PUT/DELETE
        // di bawah kalau ada review yang spam/tidak pantas.
        approved: true,
      });

      const updatedReviewedItemIds = [...reviewedItemIds, productIdStr];

      transaction.update(orderRef, {
        reviewedItemIds: updatedReviewedItemIds,
        // Tetap set hasBeenReviewed:true untuk kompatibilitas data lama,
        // artinya "order ini sudah punya minimal 1 review"
        hasBeenReviewed: true,
      });

      return { reviewId: newReviewRef.id };
    });

    return Response.json(
      {
        message: "Review submitted successfully!",
        reviewId: result.reviewId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error submitting review:", error);
    return Response.json(
      { error: error.message || "Failed to submit review." },
      { status: 500 },
    );
  }
}

// GET -> Ambil Daftar Review
// - Mode publik (?public=true): review yang approved saja, tanpa perlu login.
//   Dipakai halaman Shop untuk menampilkan ulasan di setiap produk.
// - Mode admin (default, tanpa ?public=true): semua review, perlu token admin.
//   Dipakai dashboard admin untuk moderasi.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const isPublicRequest = searchParams.get("public") === "true";

  try {
    if (isPublicRequest) {
      let reviewsQuery = db.collection("reviews").where("approved", "==", true);
      if (productId) {
        reviewsQuery = reviewsQuery.where("productId", "==", String(productId));
      }
      const snapshot = await reviewsQuery.get();
      const reviews = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return Response.json({ reviews }, { status: 200 });
    }

    try {
      await verifyAdmin(request.headers.get("Authorization"));
    } catch (error) {
      return Response.json(
        { error: `Admin verification failed: ${error.message}` },
        { status: 403 },
      );
    }

    const reviewsSnapshot = await db
      .collection("reviews")
      .orderBy("createdAt", "desc")
      .get();

    const reviews = reviewsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return Response.json({ reviews }, { status: 200 });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return Response.json(
      { error: "Failed to fetch reviews." },
      { status: 500 },
    );
  }
}

// PUT -> Update Status Approval Review (Admin) — dipakai untuk sembunyikan
// review spam/tidak pantas tanpa menghapusnya permanen.
export async function PUT(request) {
  try {
    try {
      await verifyAdmin(request.headers.get("Authorization"));
    } catch (error) {
      return Response.json(
        { error: `Admin verification failed: ${error.message}` },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reviewId, approved } = body;

    if (!reviewId || typeof approved !== "boolean") {
      return Response.json(
        { error: "Missing required fields: reviewId and approved status." },
        { status: 400 },
      );
    }

    const reviewRef = db.collection("reviews").doc(reviewId);
    await reviewRef.update({ approved });

    return Response.json(
      { message: `Review ${reviewId} status updated to ${approved}.` },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating review:", error);
    return Response.json(
      { error: "Failed to update review." },
      { status: 500 },
    );
  }
}

// DELETE -> Hapus Review Permanen (Admin)
export async function DELETE(request) {
  try {
    try {
      await verifyAdmin(request.headers.get("Authorization"));
    } catch (error) {
      return Response.json(
        { error: `Admin verification failed: ${error.message}` },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reviewId } = body;

    if (!reviewId) {
      return Response.json(
        { error: "Missing required field: reviewId." },
        { status: 400 },
      );
    }

    const reviewRef = db.collection("reviews").doc(reviewId);
    await reviewRef.delete();

    return Response.json(
      { message: `Review ${reviewId} deleted successfully.` },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting review:", error);
    return Response.json(
      { error: "Failed to delete review." },
      { status: 500 },
    );
  }
}
