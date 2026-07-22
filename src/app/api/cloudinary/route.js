import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
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

// POST -> dipakai untuk UPLOAD avatar baru maupun UPDATE (ganti) avatar.
// Kirim formData: file, userId, dan (opsional) oldPublicId / oldUrl
// kalau user sebelumnya sudah pernah upload dengan skema public_id lain.
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const userId = formData.get("userId");
    const oldPublicId = formData.get("oldPublicId");
    const oldUrl = formData.get("oldUrl");

    if (!file || !userId) {
      return NextResponse.json(
        { error: "File and userId are required" },
        { status: 400 },
      );
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    const newPublicId = getAvatarPublicId(userId);
    const resolvedOldPublicId =
      oldPublicId || (oldUrl ? extractPublicIdFromUrl(oldUrl) : null);

    // Hapus file lama dulu KALAU public_id-nya beda dari skema baru
    // (misal data lama pakai public_id acak/timestamp). Kalau sama
    // persis, tidak perlu destroy karena upload baru akan overwrite.
    if (resolvedOldPublicId && resolvedOldPublicId !== newPublicId) {
      await safeDestroy(resolvedOldPublicId);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "avatars",
          public_id: `user_${userId}`,
          resource_type: "image",
          overwrite: true,
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
