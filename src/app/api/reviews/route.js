import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

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

// Helper untuk verifikasi bahwa user adalah admin
async function verifyAdmin(authHeader) {
    const decodedToken = await verifyUser(authHeader);
    const user = await getAuth().getUser(decodedToken.uid);
    if (user.customClaims?.role !== 'admin') {
        throw new Error("User is not an administrator.");
    }
    return decodedToken;
}


export async function POST(request) {
  let decodedToken;
  try {
    decodedToken = await verifyUser(request.headers.get("Authorization"));
  } catch (error) {
    return new Response(JSON.stringify({ error: `Authentication failed: ${error.message}` }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const { userId, orderId, productId, productName, rating, comment } = await request.json();

  // 1. Validasi input
  if (decodedToken.uid !== userId) {
    return new Response(JSON.stringify({ error: "User ID mismatch. You can only submit reviews for yourself." }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  if (!orderId || !productId || !rating || !comment) {
    return new Response(JSON.stringify({ error: "Missing required fields: orderId, productId, rating, comment." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const orderRef = db.collection("orders").doc(orderId);
    const reviewRef = db.collection("reviews").where("orderId", "==", orderId).limit(1);

    const result = await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new Error("Order not found.");
      }

      const orderData = orderDoc.data();
      if (orderData.userId !== userId) {
          throw new Error("You are not authorized to review this order.");
      }
      if (orderData.hasBeenReviewed) {
        throw new Error("This order has already been reviewed.");
      }

      // Pastikan belum ada review dengan orderId yang sama
      const reviewSnapshot = await transaction.get(reviewRef);
      if (!reviewSnapshot.empty) {
        throw new Error("A review for this order already exists.");
      }

      // 2. Buat dokumen review baru
      const newReviewRef = db.collection("reviews").doc();
      transaction.create(newReviewRef, {
        userId,
        userName: decodedToken.name || decodedToken.email, // Ambil dari token
        orderId,
        productId,
        productName: productName || "Product", // Fallback
        rating: Number(rating),
        comment,
        createdAt: FieldValue.serverTimestamp(),
        approved: false, // Default review butuh approval admin
      });
      
      // 3. Update status order menjadi sudah direview
      transaction.update(orderRef, { hasBeenReviewed: true });
      
      return { reviewId: newReviewRef.id };
    });

    return new Response(JSON.stringify({ message: "Review submitted successfully!", reviewId: result.reviewId }), { status: 201, headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error submitting review:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to submit review." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export async function GET(request) {
    try {
        await verifyAdmin(request.headers.get("Authorization"));
    } catch (error) {
        return new Response(JSON.stringify({ error: `Admin verification failed: ${error.message}` }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    try {
        const reviewsSnapshot = await db.collection("reviews").orderBy("createdAt", "desc").get();
        const reviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return new Response(JSON.stringify({ reviews }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch reviews." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}

export async function PUT(request) {
    try {
        await verifyAdmin(request.headers.get("Authorization"));
    } catch (error) {
        return new Response(JSON.stringify({ error: `Admin verification failed: ${error.message}` }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const { reviewId, approved } = await request.json();

    if (!reviewId || typeof approved !== 'boolean') {
        return new Response(JSON.stringify({ error: "Missing required fields: reviewId and approved status." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    try {
        const reviewRef = db.collection("reviews").doc(reviewId);
        await reviewRef.update({ approved });
        return new Response(JSON.stringify({ message: `Review ${reviewId} status updated to ${approved}.` }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error("Error updating review:", error);
        return new Response(JSON.stringify({ error: "Failed to update review." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}

export async function DELETE(request) {
    try {
        await verifyAdmin(request.headers.get("Authorization"));
    } catch (error) {
        return new Response(JSON.stringify({ error: `Admin verification failed: ${error.message}` }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const { reviewId } = await request.json();

    if (!reviewId) {
        return new Response(JSON.stringify({ error: "Missing required field: reviewId." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    try {
        const reviewRef = db.collection("reviews").doc(reviewId);
        await reviewRef.delete();
        return new Response(JSON.stringify({ message: `Review ${reviewId} deleted successfully.` }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error("Error deleting review:", error);
        return new Response(JSON.stringify({ error: "Failed to delete review." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}
