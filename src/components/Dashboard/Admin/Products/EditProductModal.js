"use client";
import ProductForm from "./ProductForm";
import styles from "./EditProductModal.module.css";

export default function EditProductModal({ product, onClose, onUpdate }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <ProductForm
          product={product}
          onSuccess={onUpdate}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
