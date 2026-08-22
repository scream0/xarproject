import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { verifyAdmin, verifyUser } from "@/lib/apiAuth";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const USER_FOLDERS = new Set(["avatars", "reviews", "payments", "chats"]);
const ADMIN_FOLDERS = new Set(["products", "storefront", "banners", "general", "chats"]);

async function verifyUploadAccess(request, requestedUserId, folder) {
  const user = await verifyUser(request);
  if (requestedUserId) {
    if (requestedUserId !== user.id) throw new Error("Forbidden");
    if (!USER_FOLDERS.has(folder) && !ADMIN_FOLDERS.has(folder)) {
      await verifyAdmin(request);
    }
    return { user, isAdmin: false };
  }
  if (!ADMIN_FOLDERS.has(folder)) throw new Error("Forbidden");
  await verifyAdmin(request);
  return { user, isAdmin: true };
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// public_id yang konsisten per user -> upload baru otomatis menimpa
// versi lama di public_id yang sama (tidak membuat asset baru).
function getAvatarPublicId(userId) {
  return `avatars/user_${userId}`;
}

// Fallback untuk kompatibilitas data lama yang cuma nyimpen secure_url
// (bukan public_id) di database.
function extractPublicIdFromUrl(url) {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function safeDestroy(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  } catch (err) {
    // Jangan gagalkan proses upload/hapus hanya karena file lama
    // sudah tidak ada / gagal dihapus.
    console.warn("Gagal menghapus asset lama:", publicId, err.message);
  }
}

// POST -> dipakai untuk UPLOAD avatar baru, foto review, maupun asset admin.
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const userId = formData.get("userId");
    const oldPublicId = formData.get("oldPublicId");
    const oldUrl = formData.get("oldUrl");
    const requestedFolder = formData.get("folder");
    const explicitPublicId = formData.get("publicId") || null;
    const folder = requestedFolder || (String(explicitPublicId || "").startsWith("storefront/") ? "storefront" : "avatars");
    const normalizedFolder = String(folder).replace(/^\/+|\/+$/g, "");

    await verifyUploadAccess(request, userId, normalizedFolder);

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 },
      );
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be JPG, PNG, or WebP and no larger than 5 MB" }, { status: 400 });
    }

    let newPublicId = explicitPublicId;
    if (normalizedFolder === "reviews" || normalizedFolder === "payments" || normalizedFolder === "chats") {
      newPublicId = explicitPublicId || `${normalizedFolder}/${normalizedFolder}_${userId || "user"}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    } else if (userId && normalizedFolder === "avatars") {
      newPublicId = getAvatarPublicId(userId);
    }

    const resolvedOldPublicId =
      oldPublicId || (oldUrl ? extractPublicIdFromUrl(oldUrl) : null);

    // Hapus file lama dulu KALAU public_id-nya beda dari skema baru (khusus avatar)
    if (resolvedOldPublicId && resolvedOldPublicId !== newPublicId && normalizedFolder === "avatars") {
      await safeDestroy(resolvedOldPublicId);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: normalizedFolder,
          ...(newPublicId ? { public_id: newPublicId } : {}),
          resource_type: "image",
          overwrite: normalizedFolder === "avatars",
          invalidate: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({
      success: true,
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    });
  } catch (error) {
    console.error("Gagal upload server Cloudinary:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE -> hapus avatar user (misal saat user menghapus foto profil,
// atau saat menghapus akun). Body JSON: { userId } atau { publicId }.
export async function DELETE(request) {
  try {
    const { userId, publicId } = await request.json();
    const user = await verifyUser(request);
    if (userId && userId !== user.id) {
      await verifyAdmin(request);
    } else if (!userId) {
      await verifyAdmin(request);
    }
    const targetPublicId =
      publicId || (userId ? getAvatarPublicId(userId) : null);

    if (!targetPublicId) {
      return NextResponse.json(
        { error: "userId or publicId is required" },
        { status: 400 },
      );
    }

    const result = await cloudinary.uploader.destroy(targetPublicId, {
      resource_type: "image",
      invalidate: true,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Gagal hapus avatar Cloudinary:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
