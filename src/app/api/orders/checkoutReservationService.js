function createHttpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeVariantSize(value) {
  return String(value || "default").trim().toLowerCase();
}

function buildRequestedItems(items = []) {
  const aggregated = new Map();

  for (const item of items) {
    const productId = String(
      item?.id || item?.productId || item?.product_id || "",
    ).trim();
    const variantSize = String(item?.size || item?.variantId || item?.variant_id || "default").trim();
    const quantity = Number(item?.quantity || item?.qty || 1);

    if (!productId) {
      throw createHttpError("productId wajib ada pada setiap item pesanan", 400);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createHttpError("quantity item pesanan tidak valid", 400);
    }

    const key = `${productId}::${normalizeVariantSize(variantSize)}`;
    const existing = aggregated.get(key);

    if (existing) {
      existing.quantity += quantity;
      continue;
    }

    aggregated.set(key, {
      key,
      productId,
      variantSize,
      variantNormalized: normalizeVariantSize(variantSize),
      quantity,
      productName: item?.name || "Produk",
    });
  }

  return Array.from(aggregated.values());
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCheckoutReservationService({
  db,
  supabase,
  lockCollection = "inventory_locks",
  lockTtlMs = 30_000,
  lockRetryCount = 15,
  lockRetryDelayMs = 80,
  waitFn = wait,
}) {
  async function acquireInventoryLock(lockKey, ownerId) {
    const lockRef = db.collection(lockCollection).doc(lockKey);

    for (let attempt = 0; attempt < lockRetryCount; attempt += 1) {
      try {
        await db.runTransaction(async (transaction) => {
          const now = Date.now();
          const lockDoc = await transaction.get(lockRef);

          if (lockDoc.exists) {
            const lockData = lockDoc.data() || {};
            const lockOwner = lockData.ownerId;
            const expiresAt = Number(lockData.expiresAt || 0);
            if (lockOwner && lockOwner !== ownerId && expiresAt > now) {
              throw createHttpError("LOCKED", 409);
            }
          }

          transaction.set(
            lockRef,
            {
              ownerId,
              expiresAt: now + lockTtlMs,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        });

        return lockRef;
      } catch (error) {
        if (error?.message !== "LOCKED") {
          throw error;
        }

        if (attempt >= lockRetryCount - 1) {
          throw createHttpError(
            "Sistem sedang memproses stok produk yang sama. Silakan ulangi beberapa detik lagi.",
            409,
          );
        }

        await waitFn(lockRetryDelayMs + attempt * 20);
      }
    }

    throw createHttpError("Gagal mengunci stok produk", 500);
  }

  async function releaseInventoryLocks(lockRefs, ownerId) {
    await Promise.all(
      (lockRefs || []).map(async (lockRef) => {
        try {
          await db.runTransaction(async (transaction) => {
            const lockDoc = await transaction.get(lockRef);
            if (!lockDoc.exists) return;

            const lockData = lockDoc.data() || {};
            if (lockData.ownerId === ownerId) {
              transaction.delete(lockRef);
            }
          });
        } catch (error) {
          console.error("Gagal melepaskan lock stok:", error);
        }
      }),
    );
  }

  async function reserveStockInSupabase(requestedItems) {
    if (!supabase) {
      throw createHttpError(
        "Konfigurasi database produk belum siap untuk validasi stok",
        503,
      );
    }

    const reservations = [];

    for (const requested of requestedItems) {
      const { data: product, error: fetchError } = await supabase
        .from("products")
        .select("id,name,variants")
        .eq("id", requested.productId)
        .single();

      if (fetchError || !product) {
        throw createHttpError(
          `Produk ${requested.productId} tidak ditemukan saat validasi stok`,
          409,
        );
      }

      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length === 0) {
        throw createHttpError(
          `Produk ${product.name || requested.productId} belum memiliki varian stok`,
          409,
        );
      }

      const variantIndex = variants.findIndex(
        (variant) => normalizeVariantSize(variant?.size) === requested.variantNormalized,
      );

      if (variantIndex < 0) {
        throw createHttpError(
          `Varian ${requested.variantSize || "default"} untuk produk ${product.name || requested.productId} tidak ditemukan`,
          409,
        );
      }

      const selectedVariant = variants[variantIndex] || {};
      const currentStock = Number(selectedVariant.stock ?? selectedVariant.stok ?? 0);

      if (!Number.isFinite(currentStock) || currentStock < requested.quantity) {
        throw createHttpError(
          `Stok ${product.name || requested.productName} (${requested.variantSize || "default"}) tidak cukup. Tersisa ${Math.max(0, Number.isFinite(currentStock) ? currentStock : 0)}.`,
          409,
        );
      }

      const nextStock = currentStock - requested.quantity;
      const nextVariants = variants.map((variant, index) => {
        if (index !== variantIndex) return variant;
        return {
          ...variant,
          stock: nextStock,
          stok: nextStock,
        };
      });

      const { error: updateError } = await supabase
        .from("products")
        .update({ variants: nextVariants })
        .eq("id", requested.productId);

      if (updateError) {
        throw createHttpError(
          `Gagal mengunci stok untuk produk ${product.name || requested.productId}`,
          500,
        );
      }

      reservations.push({
        productId: requested.productId,
        previousVariants: variants,
      });
    }

    return reservations;
  }

  async function rollbackReservations(reservations) {
    if (!supabase || !Array.isArray(reservations) || reservations.length === 0) {
      return;
    }

    for (const reservation of [...reservations].reverse()) {
      const { error } = await supabase
        .from("products")
        .update({ variants: reservation.previousVariants })
        .eq("id", reservation.productId);

      if (error) {
        console.error(
          `Rollback stok gagal untuk produk ${reservation.productId}:`,
          error,
        );
      }
    }
  }

  return {
    acquireInventoryLock,
    releaseInventoryLocks,
    reserveStockInSupabase,
    rollbackReservations,
  };
}

export {
  createHttpError,
  normalizeVariantSize,
  buildRequestedItems,
  createCheckoutReservationService,
};
