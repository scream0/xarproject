"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import AddProductForm from "./AddProductForm";
import EditProductModal from "./EditProductModal";
import ConfirmationModal from "@/components/UI/Modal/ConfirmationModal";
import styles from "./ProductManager.module.css";
import pmConfig from "@/data/ui/productManagerConfig.json";

const PRODUCTS_PER_PAGE = 10;
const DEBOUNCE_DELAY = 500; // 500ms

export default function ProductManager() {
  // Data and loading states
  const [products, setProducts] = useState([]);
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
  });
  const [categories, setCategories] = useState([]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("category");
    if (error) {
      console.error("Gagal mengambil kategori:", error);
      return;
    }
    const uniqueCategories = [...new Set(data.map((p) => p.category))];
    setCategories(uniqueCategories);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("products").select("*", { count: "exact" });

    // Search
    if (searchTerm) {
      query = query.ilike("name", `%${searchTerm}%`);
    }

    // Filters
    if (filters.category !== "all") {
      query = query.eq("category", filters.category);
    }
    
    // Note: Stock status filtering requires more complex logic, often better handled in a database function.
    // This is a simplified client-side filter post-fetch for demonstration.
    // For a fully professional implementation, a PostgreSQL function would be created.

    // Pagination
    const from = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const to = from + PRODUCTS_PER_PAGE - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    try {
      const { data, error, count } = await query;
      if (error) throw error;

      let processedData = data.map(product => {
        const totalStock = product.variants?.reduce((sum, v) => sum + (v.stock ?? 0), 0) || 0;
        let status = pmConfig.status.soldOut;
        if (totalStock > 5) {
          status = pmConfig.status.ready;
        } else if (totalStock > 0) {
          status = pmConfig.status.lowStock;
        }
        return { ...product, totalStock, status };
      });
      
      // Client-side filtering for stock status
      if (filters.stockStatus !== 'all') {
        processedData = processedData.filter(p => p.status === pmConfig.status[filters.stockStatus]);
      }

      setProducts(processedData);
      setProductsCount(count || 0);
    } catch (error) {
      console.error("Gagal memuat produk:", error);
      toast.error("Gagal memuat produk dari database.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, filters]);
  
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchProducts();
    }, DEBOUNCE_DELAY);
    return () => clearTimeout(debounceTimer);
  }, [fetchProducts, searchTerm]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const openDeleteModal = (product) => {
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
      if (productToDelete.image_public_id) {
        await fetch("/api/cloudinary", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId: productToDelete.image_public_id }),
        });
      }
      if (productToDelete.variants?.length) {
        for (const v of productToDelete.variants) {
          if (v.imagePublicId) {
            await fetch("/api/cloudinary", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publicId: v.imagePublicId }),
            });
          }
        }
      }

      const { error } = await supabase.from("products").delete().eq("id", productToDelete.id);
      if (error) throw error;

      toast.success(`Produk "${productToDelete.name}" berhasil dihapus.`);
      fetchProducts();
      fetchCategories();
    } catch (error) {
      console.error("Gagal menghapus produk:", error);
      toast.error("Gagal menghapus produk.");
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
        message={pmConfig.deleteModal.message.replace("{productName}", productToDelete?.name || "")}
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
          <h2 className={styles.title}>{pmConfig.title}</h2>
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
            <select className={styles.filterSelect} value={filters.stockStatus} onChange={e => handleFilterChange('stockStatus', e.target.value)}>
                <option value="all">{pmConfig.filters.all}</option>
                <option value="ready">{pmConfig.filters.ready}</option>
                <option value="lowStock">{pmConfig.filters.lowStock}</option>
                <option value="soldOut">{pmConfig.filters.soldOut}</option>
            </select>
            <select className={styles.filterSelect} value={filters.category} onChange={e => handleFilterChange('category', e.target.value)}>
                <option value="all">{pmConfig.filters.all} Kategori</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>{pmConfig.loadingText}</div>
        ) : products.length === 0 ? (
          <div className={styles.emptyState}>
            {searchTerm || filters.stockStatus !== 'all' || filters.category !== 'all' ? pmConfig.emptyText : pmConfig.emptyState}
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                <thead>
                    <tr>
                    <th>{pmConfig.tableHeaders.image}</th>
                    <th>{pmConfig.tableHeaders.name}</th>
                    <th>{pmConfig.tableHeaders.category}</th>
                    <th>{pmConfig.tableHeaders.stock}</th>
                    <th>{pmConfig.tableHeaders.status}</th>
                    <th>{pmConfig.tableHeaders.actions}</th>
                    </tr>
                </thead>
                <tbody>
                    {products.map((item) => (
                    <tr key={item.id}>
                        <td>
                        {item.image_url && (
                            <img src={item.image_url} alt={item.name} className={styles.productImage}/>
                        )}
                        </td>
                        <td className={styles.productNameCell}>{item.name}</td>
                        <td>{item.category}</td>
                        <td>{item.totalStock}</td>
                        <td>
                        <span className={`${styles.statusBadge} ${styles[`status${item.status.replace(/\s+/g, '')}`]}`}>
                            {item.status}
                        </span>
                        </td>
                        <td>
                        <div className={styles.actionButtons}>
                            <button onClick={() => setEditingProduct(item)} className={styles.editBtn}>{pmConfig.actions.edit}</button>
                            <button onClick={() => openDeleteModal(item)} className={styles.deleteBtn}>{pmConfig.actions.delete}</button>
                        </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            <div className={styles.pagination}>
                <span>{pmConfig.pagination.page} {currentPage} {pmConfig.pagination.of} {totalPages}</span>
                <div className={styles.paginationButtons}>
                    <button onClick={() => setCurrentPage(prev => prev - 1)} disabled={currentPage === 1}>{pmConfig.pagination.previous}</button>
                    <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage === totalPages}>{pmConfig.pagination.next}</button>
                </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.formSection}>
        <AddProductForm onProductAdded={() => { fetchProducts(); fetchCategories(); }} />
      </div>
    </div>
  );
}
