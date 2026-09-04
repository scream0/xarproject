// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import AddProductForm from "./AddProductForm";
import EditProductModal from "./EditProductModal";
import ConfirmationModal from "@/components/UI/Modal/ConfirmationModal";
import styles from "./ProductManager.module.css";
import pmConfig from "@/data/ui/productManagerConfig.json";

const PRODUCTS_PER_PAGE = 100;
const DEBOUNCE_DELAY = 500;

export default function ProductManager() {
  // Data and loading states
  const [products, setProducts] = useState<any[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [editingProduct, setEditingProduct] = useState(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Control states
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    stockStatus: "all",
    category: "all",
    status: "all",
  });
  const [categories, setCategories] = useState<any[]>([]);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("category")
        .not("category", "is", null);

      if (error) {
        console.error("Gagal mengambil kategori:", error);
        return;
      }
      const parsedCategories = Array.from(
        new Set(
          (data || [])
            .map((item) => (typeof item?.category === "string" ? item.category.trim() : ""))
            .filter(Boolean)
        )
      ).sort();
      setCategories(parsedCategories);
    } catch (err) {
      console.error("Gagal mengambil kategori:", err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set("page", currentPage);
    params.set("limit", PRODUCTS_PER_PAGE);

    // Search
    if (searchTerm) {
      params.set("search", searchTerm);
    }

    // Filters
    if (filters.category !== "all") {
      params.set("category", filters.category);
    }
    if (filters.status !== "all") {
      params.set("status", filters.status);
    }

    // Pagination/Sort
    // Go API default sorts by created_at desc

    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/products?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal mengambil data produk dari server");
      const result = await res.json();
      
      const data = result.data || [];
      const count = result.total || 0;

      let processedData = data.map((product: any) => {
        const totalStock =
          product.variants?.reduce((sum, v: any) => sum + (v.stock ?? 0), 0) || 0;
        let computedStockStatus = pmConfig.status.soldOut;
        if (totalStock > 5) {
          computedStockStatus = pmConfig.status.ready;
        } else if (totalStock > 0) {
          computedStockStatus = pmConfig.status.lowStock;
        }
        return { ...product, totalStock, computedStockStatus };
      });

      // Client-side filtering for stock status
      if (filters.stockStatus !== "all") {
        processedData = processedData.filter(
          (p: any) => p.computedStockStatus === pmConfig.status[filters.stockStatus],
        );
      }

      setProducts(processedData);
      setProductsCount(count || 0);
    } catch (error) {
      console.error("Gagal memuat produk:", error);
      toast.error(pmConfig.toasts.fetchError);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchProducts();
    }, DEBOUNCE_DELAY);
    return () => clearTimeout(debounceTimer);
  }, [fetchProducts, searchTerm]);

  const handleFilterChange = (filterType, value: any) => {
    setFilters((prev) => ({ ...prev, [filterType]: value }));
    setCurrentPage(1);
  };

  const openDeleteModal = (product: any) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setProductToDelete(null);
    setDeleteModalOpen(false);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      if (productToDelete.image_public_id) {
        await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ publicId: productToDelete.image_public_id }),
        });
      }
      if (productToDelete.variants?.length) {
        for (const v of productToDelete.variants) {
          if (v.imagePublicId) {
            await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
              method: "DELETE",
              headers: { "Content-Type": "application/json", ...authHeaders },
              body: JSON.stringify({ publicId: v.imagePublicId }),
            });
          }
        }
      }

      const deleteRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/products?id=${productToDelete.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const deleteData = await deleteRes.json().catch(() => ({}));
      if (!deleteRes.ok) throw new Error(deleteData.error || "Gagal menghapus produk dari database.");

      toast.success(pmConfig.toasts.deleteSuccess);
      fetchProducts();
      fetchCategories();
    } catch (error) {
        console.error("Gagal menghapus produk:", error);
        toast.error(error.message || pmConfig.toasts.deleteError);
      } finally {
        closeDeleteModal();
      }
  };

  const totalPages = Math.ceil(productsCount / PRODUCTS_PER_PAGE);

  return (
    <div className={styles.container}>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        title={pmConfig.deleteModal.title}
        message={pmConfig.deleteModal.message.replace(
          "{productName}",
          productToDelete?.name || "",
        )}
        confirmButtonText={pmConfig.deleteModal.confirmButton}
        cancelButtonText={pmConfig.deleteModal.cancelButton}
      />

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onUpdate={() => {
            setEditingProduct(null);
            fetchProducts();
            fetchCategories();
          }}
        />
      )}

      <div className={styles.inventorySection}>
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>{pmConfig.title}</h2>
            <p className={styles.subtitle}>Keep inventory healthy and spot issues before they affect sales.</p>
          </div>
          <div className={styles.summaryPillGroup}>
            <span className={styles.summaryPill}>Live inventory</span>
            <span className={styles.summaryPill}>Fast updates</span>
          </div>
        </div>

        <div className={styles.controlsContainer}>
          <input
            type="text"
            placeholder={pmConfig.searchPlaceholder}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={styles.searchInput}
          />
          <div className={styles.filters}>
            <select
              className={styles.filterSelect}
              value={filters.stockStatus}
              onChange={(e) =>
                handleFilterChange("stockStatus", e.target.value)
              }
            >
              <option value="all">{pmConfig.filters.all}</option>
              <option value="ready">{pmConfig.filters.ready}</option>
              <option value="lowStock">{pmConfig.filters.lowStock}</option>
              <option value="soldOut">{pmConfig.filters.soldOut}</option>
            </select>
            <select
              className={styles.filterSelect}
              value={filters.category}
              onChange={(e) => handleFilterChange("category", e.target.value)}
            >
              <option value="all">{pmConfig.filters.all} Kategori</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
                className={styles.filterSelect}
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
            >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>{pmConfig.loadingText}</div>
        ) : products.length === 0 ? (
          <div className={styles.emptyState}>
            {searchTerm ||
            filters.stockStatus !== "all" ||
            filters.category !== "all"
              ? pmConfig.emptyText
              : pmConfig.emptyState}
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{pmConfig.tableHeaders.image}</th>
                    <th>{pmConfig.tableHeaders.name}</th>
                    <th>SKU</th>
                    <th>{pmConfig.tableHeaders.category}</th>
                    <th>{pmConfig.tableHeaders.stock}</th>
                    <th>{pmConfig.tableHeaders.status}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className={styles.productImage}
                          />
                        )}
                      </td>
                      <td className={styles.productNameCell}>{item.name}</td>
                      <td>{item.variants?.map((v: any) => v.sku).join(', ')}</td>
                      <td>{item.category}</td>
                      <td>{item.totalStock}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${styles[`status${item.computedStockStatus.replace(/\s+/g, "")}`]}`}
                        >
                          {item.computedStockStatus}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            onClick={() => setEditingProduct(item)}
                            className={styles.editBtn}
                          >
                            {pmConfig.actions.edit}
                          </button>
                          <button
                            onClick={() => openDeleteModal(item)}
                            className={styles.deleteBtn}
                          >
                            {pmConfig.actions.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <span>
                {pmConfig.pagination.page} {currentPage}{" "}
                {pmConfig.pagination.of} {totalPages}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                  disabled={currentPage === 1}
                >
                  {pmConfig.pagination.previous}
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={currentPage === totalPages}
                >
                  {pmConfig.pagination.next}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.formSection}>
        <AddProductForm
          onProductAdded={() => {
            fetchProducts();
            fetchCategories();
          }}
        />
      </div>
    </div>
  );
}
