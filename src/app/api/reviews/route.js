import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const MAX_REVIEW_COMMENT_LENGTH = 1500;

async function verifyUser(authHeader) {
  if (!authHeader) {
    throw new Error("No authorization header provided.");
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    throw new Error("Invalid authorization header format.");
  }
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error(`Authentication failed: ${error?.message || "Invalid token"}`);
  }
  return {
    uid: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
    role: user.user_metadata?.role,
  };
}

async function verifyAdmin(authHeader) {
  const user = await verifyUser(authHeader);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.uid)
    .maybeSingle();

  if (["admin", "superadmin"].includes(String(profile?.role || "").toLowerCase())) {
    return user;
  }

  throw new Error("User is not an administrator.");
}

export async function POST(request) {
  try {
    let currentUser;
    try {
      currentUser = await verifyUser(request.headers.get("Authorization"));
    } catch (error) {
      return Response.json(
        { error: `Authentication failed: ${error.message}` },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId, orderId, productId, productName, rating, comment, reviewPhoto, review_photo } = body;

    if (currentUser.uid !== userId) {
      return Response.json(
        { error: "User ID mismatch. You can only submit reviews for yourself." },
        { status: 403 },
      );
    }
    if (!orderId || !productId || !rating || !comment) {
      return Response.json(
        { error: "Missing required fields: orderId, productId, rating, comment." },
        { status: 400 },
      );
    }
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return Response.json({ error: "Rating must be an integer between 1 and 5." }, { status: 400 });
    }

    const cleanComment = String(comment).trim();
    if (!cleanComment) {
      return Response.json({ error: "Comment is required." }, { status: 400 });
    }
    if (cleanComment.length > MAX_REVIEW_COMMENT_LENGTH) {
      return Response.json({ error: `Comment must be ${MAX_REVIEW_COMMENT_LENGTH} characters or less.` }, { status: 400 });
    }

    const { data: orderDoc, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .single();

    if (orderErr || !orderDoc) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }
    const orderStatus = (orderDoc.status || "").toLowerCase();
    if (orderStatus !== "completed" && orderStatus !== "delivered") {
      return Response.json({ error: "Reviews are available after the order is completed." }, { status: 400 });
    }
    if (orderDoc.user_id !== userId) {
      return Response.json({ error: "You are not authorized to review this order." }, { status: 403 });
    }

    const { data: orderItem, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();
    if (itemErr) throw itemErr;
    if (!orderItem) {
      return Response.json({ error: "Product is not part of the specified order." }, { status: 400 });
    }

    const { data: existingReviews } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_id", productId)
      .limit(1);

    if (existingReviews && existingReviews.length > 0) {
      return Response.json({ error: "Produk ini pada pesanan tersebut sudah diulas." }, { status: 400 });
    }

    const photoUrl = reviewPhoto || review_photo || null;

    const { data: newReview, error: insertErr } = await supabaseAdmin
      .from("reviews")
      .insert({
        user_id: userId,
        order_id: orderId,
        product_id: productId,
        user_name: currentUser.name || "Pelanggan",
        product_name: productName || "Product",
        rating: numericRating,
        comment: cleanComment,
        review_photo: photoUrl,
        approved: true,
      })
      .select("id")
      .single();

    if (insertErr) {
      throw insertErr;
    }

    return Response.json(
      {
        message: "Review submitted successfully!",
        reviewId: newReview.id,
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const isPublicRequest = searchParams.get("public") === "true";

  try {
    if (isPublicRequest) {
      const page = Math.max(1, Number(searchParams.get("page") || 1));
      const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 10)));
      
      let query = supabaseAdmin.from("reviews").select("id, product_id, user_name, product_name, rating, comment, review_photo, created_at").eq("approved", true);
      if (productId) {
        query = query.eq("product_id", productId);
      }
      
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
        
      if (error) throw error;

      const reviews = (data || []).map((r) => ({
        id: r.id,
        productId: r.product_id,
        userName: r.user_name,
        productName: r.product_name,
        rating: r.rating,
        comment: r.comment,
        reviewPhoto: r.review_photo,
        createdAt: r.created_at,
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

    const { data, error } = await supabaseAdmin.from("reviews").select("id, product_id, user_name, rating, comment, review_photo, created_at, approved, user_id, order_id, product_name, updated_at").order("created_at", { ascending: false });
    if (error) throw error;
    
    const reviews = (data || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      orderId: r.order_id,
      productId: r.product_id,
      userName: r.user_name,
      productName: r.product_name,
      rating: r.rating,
      comment: r.comment,
      reviewPhoto: r.review_photo,
      approved: r.approved,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
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

    const { error } = await supabaseAdmin.from("reviews").update({ approved }).eq("id", reviewId);
    if (error) throw error;

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

    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", reviewId);
    if (error) throw error;

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