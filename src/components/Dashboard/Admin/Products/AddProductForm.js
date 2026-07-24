"use client";
import ProductForm from "./ProductForm";

export default function AddProductForm({ onProductAdded }) {
  return <ProductForm onSuccess={onProductAdded} />;
}
